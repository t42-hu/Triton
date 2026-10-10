import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import ICAL from 'ical.js'

/** Disposable users exercise the real HTTP auth, serialization, and revocation paths. */
export async function verifyCalendarSharingHttp(pool, origin, secret, cookiePrefix) {
    const users = []
    for (let index = 0; index < 2; index++) {
        const id = randomUUID(), token = randomUUID()
        await pool.query('INSERT INTO "user"(id,name,email,created_at,updated_at) VALUES($1,$2,$3,now(),now())', [id,'Sharing test',`${id}@example.test`])
        await pool.query("INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '5 minutes',now(),now())", [randomUUID(),token,id])
        users.push({ id, cookie: `${cookiePrefix}.session_token=${encodeURIComponent(`${token}.${createHmac('sha256',secret).update(token).digest('base64')}`)}` })
    }
    const [owner, stranger] = users
    async function request(who, method, path, body, status = 200) {
        const response = await fetch(`${origin}/api/${path}`, { method, headers: { ...(who ? { cookie: who.cookie } : {}), ...(body ? { 'content-type':'application/json' } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) })
        assert.equal(response.status,status,`${method} ${path.split('/').slice(0,2).join('/')}: ${await response.clone().text()}`)
        return response
    }
    try {
        await request(null,'GET','calendar-share',undefined,401)
        const calendar = await (await request(owner,'POST','calendar/calendars',{ name:'Sharing fixture' },201)).json()
        const profile = await (await request(owner,'POST','calendar/profiles',{ name:'Own',isOwn:true },201)).json()
        await request(owner,'POST','calendar/profile-calendars',{ profileId:profile.id,calendarId:calendar.id },201)
        const all = { sourceIds:[],includeManual:true,categories:['lesson','event','assignment','test','exam'] }
        const event = await (await request(owner,'POST','calendar/events',{ calendarId:calendar.id,title:'Original',startsAt:'2026-10-09T08:00:00Z',endsAt:'2026-10-09T09:00:00Z' },201)).json()
        await request(owner,'POST','calendar/overrides',{ eventId:event.id, title:'Changed', occurrenceKey:'' },201)
        const hidden = await (await request(owner,'POST','calendar/events',{ calendarId:calendar.id,title:'Hidden',startsAt:'2026-10-09T10:00:00Z',endsAt:'2026-10-09T11:00:00Z' },201)).json()
        await request(owner,'POST','calendar/overrides',{ eventId:hidden.id, hidden:true, occurrenceKey:'' },201)
        await request(stranger,'POST','calendar-share',{ calendarId:calendar.id,selection:all },404)
        const friendCalendar = await (await request(owner,'POST','calendar/calendars',{ name:'Friend' },201)).json()
        const friendProfile = await (await request(owner,'POST','calendar/profiles',{ name:'Friend',isOwn:false },201)).json()
        await request(owner,'POST','calendar/profile-calendars',{ profileId:friendProfile.id,calendarId:friendCalendar.id },201)
        const friendSource = await (await request(owner,'POST','calendar/sources',{ calendarId:friendCalendar.id,name:'Friend ICS',format:'ics' },201)).json()
        await request(owner,'POST','calendar-share',{ calendarId:friendCalendar.id,selection:all },400)
        await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:{ ...all,sourceIds:[friendSource.id] } },400)
        await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:{ ...all,categories:[] } },400)
        await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:{ ...all,includeManual:false } },400)
        await request(owner,'POST','calendar-share',{ calendarId:calendar.id },400)
        assert.deepEqual((await (await request(owner,'GET','calendar-share/options')).json()).map(option=>option.calendarId),[calendar.id])
        const share = await (await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:all },201)).json()
        assert.equal((await (await request(stranger,'GET','calendar-share')).json()).length,0)
        assert.equal((await (await request(owner,'GET','calendar-share')).json()).length,1)
        const path = new URL(share.url).pathname.replace(/^\/api\//,'')
        const download = await request(null,'GET',path)
        assert.equal(download.headers.get('cache-control'),'private, no-store')
        assert.match(download.headers.get('content-type'),/text\/calendar/)
        const events = new ICAL.Component(ICAL.parse(await download.text())).getAllSubcomponents('vevent')
        assert.equal(events.length,1)
        assert.equal(events[0].getFirstPropertyValue('summary'),'Changed')
        assert.equal(events[0].getFirstPropertyValue('dtstart').toString(),'2026-10-09T08:00:00Z')
        await update(request,owner,`calendar/events/${event.id}`,{ startsAt:'2026-10-09T08:30:00Z',endsAt:'2026-10-09T09:30:00Z' })
        const refreshed = new ICAL.Component(ICAL.parse(await (await request(null,'GET',path)).text())).getAllSubcomponents('vevent')
        assert.equal(refreshed[0].getFirstPropertyValue('dtstart').toString(),'2026-10-09T08:30:00Z')
        assert.equal(refreshed[0].getFirstPropertyValue('uid'),events[0].getFirstPropertyValue('uid'))
        await verifySelection(request, owner, calendar, friendSource, all)
        const legacyId = randomUUID()
        await pool.query('INSERT INTO calendar_share(id,owner_user_id,calendar_id) VALUES($1,$2,$3)',[legacyId,owner.id,friendCalendar.id])
        const legacyToken = createHmac('sha256',secret).update(`calendar-share:v1:${legacyId}`).digest('base64url')
        await request(null,'GET',`calendar-share/${legacyId}/${legacyToken}/calendar.ics`,undefined,404)

        await request(stranger,'DELETE',`calendar-share/${share.id}`,undefined,404)
        await request(owner,'DELETE',`calendar-share/${share.id}`)
        await request(owner,'DELETE',`calendar-share/${share.id}`)
        await request(null,'GET',path,undefined,404)
        const revoked = await (await request(owner,'GET','calendar-share')).json()
        assert.equal(revoked.find(item=>item.id===share.id).url,null)
        assert.ok(revoked.find(item=>item.id===share.id).revokedAt)
        const replacement = await (await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:all },201)).json()
        assert.notEqual(replacement.url,share.url)
        await request(null,'GET',new URL(replacement.url).pathname.replace(/^\/api\//,''))
        await update(request,owner,`calendar/profiles/${profile.id}`,{ isOwn:false })
        await request(null,'GET',new URL(replacement.url).pathname.replace(/^\/api\//,''),undefined,404)
        assert.equal((await (await request(owner,'GET','calendar-share/options')).json()).length,0)
        const unavailable = (await (await request(owner,'GET','calendar-share')).json()).find(item=>item.id===replacement.id)
        assert.equal(unavailable.available,false); assert.equal(unavailable.url,null)
        await update(request,owner,`calendar/profiles/${profile.id}`,{ isOwn:true,linkedUserId:stranger.id })
        await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:all },400)
        await request(null,'GET',new URL(replacement.url).pathname.replace(/^\/api\//,''),undefined,404)
    } finally {
        await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])',[users.map(user=>user.id)])
    }
}

async function verifySelection(request, owner, calendar, friendSource, all) {
    const sources = []
    for (const [name,format] of [['ICS file','ics'],['Calendar link','ics'],['Manual','manual']]) {
        sources.push(await (await request(owner,'POST','calendar/sources',{ calendarId:calendar.id,name,format },201)).json())
    }
    await request(owner,'POST','calendar/source-connections',{ sourceId:sources[1].id,url:'https://example.test/private.ics',autoSync:true },201)
    const options = (await (await request(owner,'GET','calendar-share/options')).json())[0]
    assert.equal(options.sources.find(source=>source.id===sources[0].id).type,'ics')
    assert.equal(options.sources.find(source=>source.id===sources[1].id).type,'link')
    assert.equal(options.sources.some(source=>source.id===friendSource.id),false)
    const created = []
    for (const source of sources) for (const category of all.categories) {
        created.push(await (await request(owner,'POST','calendar/events',{ calendarId:calendar.id,sourceId:source.id,title:`${source.name} ${category}`,category,startsAt:'2026-10-10T08:00:00Z',endsAt:'2026-10-10T09:00:00Z' },201)).json())
    }
    const selection = { sourceIds:[sources[0].id],includeManual:false,categories:['test','assignment'] }
    const share = await (await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection },201)).json()
    assert.deepEqual(share.selection,selection)
    const path = new URL(share.url).pathname.replace(/^\/api\//,'')
    const get = async () => new ICAL.Component(ICAL.parse(await (await request(null,'GET',path)).text())).getAllSubcomponents('vevent')
    assert.deepEqual((await get()).map(event=>event.getFirstPropertyValue('summary')).sort(),['ICS file assignment','ICS file test'])
    const added = await (await request(owner,'POST','calendar/events',{ calendarId:calendar.id,sourceId:sources[0].id,title:'New exam',category:'exam',startsAt:'2026-10-11T08:00:00Z',endsAt:'2026-10-11T09:00:00Z' },201)).json()
    assert.equal((await get()).length,2)
    await update(request,owner,`calendar/events/${added.id}`,{ category:'test' })
    assert.equal((await get()).length,3)
    await remove(request,owner,`calendar/events/${added.id}`)
    assert.equal((await get()).length,2)
    await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:{ ...selection,sourceIds:[sources[2].id] } },400)
    await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:{ ...selection,sourceIds:[sources[0].id,sources[0].id] } },400)
    await update(request,owner,`calendar/sources/${sources[0].id}`,{ name:'Updated source' })
    assert.equal((await get()).length,2)
    const manualShare = await (await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:all },201)).json()
    const manualFeed = new ICAL.Component(ICAL.parse(await (await request(null,'GET',new URL(manualShare.url).pathname.replace(/^\/api\//,''))).text())).getAllSubcomponents('vevent')
    assert.equal(manualFeed.length,6)
    assert.deepEqual(manualFeed.filter(event=>event.getFirstPropertyValue('summary').startsWith('Manual ')).map(event=>event.getFirstPropertyValue('x-triton-category')).sort(),all.categories.slice().sort())
    const linkShare = await (await request(owner,'POST','calendar-share',{ calendarId:calendar.id,selection:{ sourceIds:[sources[1].id],includeManual:false,categories:['exam'] } },201)).json()
    const linkFeed = await (await request(null,'GET',new URL(linkShare.url).pathname.replace(/^\/api\//,''))).text()
    assert.ok(!linkFeed.includes('private.ics'))
    assert.deepEqual(new ICAL.Component(ICAL.parse(linkFeed)).getAllSubcomponents('vevent').map(event=>event.getFirstPropertyValue('summary')),['Calendar link exam'])
    await remove(request,owner,`calendar/sources/${sources[0].id}`)
    assert.equal((await get()).length,0)

}

async function update(request, who, path, data) {
    const record = await (await request(who,'GET',path)).json()
    return request(who,'PATCH',path,{ ...data,version:record.version })
}
async function remove(request, who, path) {
    const record = await (await request(who,'GET',path)).json()
    return request(who,'DELETE',path,{ version:record.version })
}
