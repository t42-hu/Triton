"""Check a focused input or the daily calendar using agent-device.

Usage: python3 scripts/check-mobile-panels.py keyboard 'Field label' -- DEVICE_FLAGS
       python3 scripts/check-mobile-panels.py keyboard-scroll -- DEVICE_FLAGS
       python3 scripts/check-mobile-panels.py calendar -- DEVICE_FLAGS
       python3 scripts/check-mobile-panels.py panel -- DEVICE_FLAGS
       python3 scripts/check-mobile-panels.py expand 'Toggle label' 'Final control' -- DEVICE_FLAGS
Set TRITON_AGENT_DEVICE when agent-device is not on PATH.
"""

import json
import os
import subprocess
import sys
import time


def run_device(*command):
    """Forward the selected host and session to every device command."""
    separator = sys.argv.index('--')
    executable = os.environ.get('TRITON_AGENT_DEVICE', 'agent-device')
    return subprocess.check_output(
        [executable, *command, *sys.argv[separator + 1:]], text=True)


def snapshot():
    """Read the currently visible native accessibility tree."""
    return json.loads(run_device('snapshot', '-i', '--json'))['data']


def check_keyboard(label):
    """Require the focused field to remain visible above an open keyboard."""
    screen = snapshot()
    field = next(node for node in screen['nodes']
                 if label in (node.get('label'), node.get('value'))
                 and node['type'] in ('TextField', 'TextView'))
    keyboard = screen.get('keyboard', {})
    assert keyboard.get('kind') == 'visible', 'Open the keyboard before checking'
    application = next(node for node in screen['nodes'] if node['type'] == 'Application')
    keyboard_top = keyboard['frame']['y']
    assert 0 < keyboard_top < application['rect']['height'], 'Keyboard is outside the screen'
    assert field['rect']['y'] >= 0, 'Field is above the screen'
    assert field['rect']['y'] + field['rect']['height'] <= keyboard_top, 'Keyboard hides the field'
    print('PASS: the field is visible above the keyboard')


def check_keyboard_scroll():
    """Scrolling an open form preserves the software keyboard and changes its content offset."""
    before = snapshot()
    keyboard = before.get('keyboard', {})
    assert keyboard.get('kind') == 'visible', 'Open the software keyboard before checking'
    panels = [node for node in before['nodes'] if node['type'] == 'ScrollView']
    panel = max(panels, key=lambda node: node['depth'])
    frame = panel['rect']
    assert frame['y'] + frame['height'] <= keyboard['frame']['y'], 'Panel extends behind the keyboard'
    start_y = min(frame['y'] + frame['height'] - 15, keyboard['frame']['y'] - 15)
    end_y = max(frame['y'] + 15, start_y - 100)
    run_device('swipe', str(round(frame['x'] + frame['width'] / 2)), str(round(start_y)),
               str(round(frame['x'] + frame['width'] / 2)), str(round(end_y)))
    after = snapshot()
    assert after.get('keyboard', {}).get('kind') == 'visible', 'Scrolling dismissed the keyboard'
    before_fields = [(node.get('label'), node['rect']['y']) for node in before['nodes'] if node['type'] == 'TextField']
    after_fields = [(node.get('label'), node['rect']['y']) for node in after['nodes'] if node['type'] == 'TextField']
    assert before_fields != after_fields, 'Form content did not scroll'
    print('PASS: the panel stays above the keyboard and scrolling preserves it')


def check_calendar():
    """Reach the final hour without scrolling the surrounding page."""
    before = snapshot()['nodes']
    header = next(node for node in before if node.get('label') == 'Triton42')
    panel = next(node for node in before
                 if node['type'] == 'ScrollView' and node['depth'] == max(
                     item['depth'] for item in before if item['type'] == 'ScrollView'))
    frame = panel['rect']
    start_y = min(frame['y'] + frame['height'] - 20, 780)
    end_y = max(frame['y'] + 20, start_y - 200)
    for _ in range(6):
        run_device('swipe', str(round(frame['x'] + frame['width'] / 2)), str(round(start_y)),
                   str(round(frame['x'] + frame['width'] / 2)), str(round(end_y)))
    after = snapshot()['nodes']
    assert any(node.get('label') == '20:00' for node in after), 'The final hour is unreachable'
    next_header = next(node for node in after if node.get('label') == 'Triton42')
    assert abs(next_header['rect']['y'] - header['rect']['y']) < 2, 'The outer page scrolled'
    print('PASS: the final hour is reachable and the outer page stayed still')


def check_panel():
    """Require the panel controls to fit between the persistent navigation bars."""
    nodes = snapshot()['nodes']
    header_action = next(node for node in nodes if node.get('label') == 'Új óra / esemény')
    navigation = next(node for node in nodes if node.get('label') == 'Menü')
    close_action = next(node for node in nodes if node.get('label') == 'Bezárás')
    scroll_panels = [node for node in nodes if node['type'] == 'ScrollView' and node['index'] > close_action['index']]
    panel = max(scroll_panels, key=lambda node: node['depth'])
    header_bottom = header_action['rect']['y'] + header_action['rect']['height']
    assert close_action['rect']['y'] > header_bottom + 8, 'Panel overlaps the header'
    assert panel['rect']['y'] + panel['rect']['height'] < navigation['rect']['y'] - 8, 'Panel overlaps navigation'
    print('PASS: the panel stays between the navigation bars')


def check_expansion(toggle_label, final_label):
    """Opening a disclosure automatically reveals its last action inside the panel."""
    before = snapshot()['nodes']
    toggle = next(node for node in before if node.get('label') == toggle_label)
    run_device('click', '@' + toggle['ref'])
    time.sleep(0.5)
    nodes = snapshot()['nodes']
    close_action = next(node for node in nodes if node.get('label') == 'Bezárás')
    panel = next(node for node in nodes if node['type'] == 'ScrollView' and node['index'] > close_action['index'])
    final_action = next(node for node in nodes if node.get('label') == final_label)
    assert final_action['rect']['y'] >= panel['rect']['y'], 'The final action is above the panel'
    assert final_action['rect']['y'] + final_action['rect']['height'] <= panel['rect']['y'] + panel['rect']['height'], 'The final action needs manual scrolling'
    print('PASS: opening the disclosure reveals its final action automatically')


if __name__ == '__main__':
    if sys.argv[1] == 'keyboard':
        check_keyboard(sys.argv[2])
    elif sys.argv[1] == 'expand':
        check_expansion(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'panel':
        check_panel()
    elif sys.argv[1] == 'keyboard-scroll':
        check_keyboard_scroll()
    else:
        check_calendar()
