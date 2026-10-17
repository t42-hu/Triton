import { requireOptionalNativeModule } from 'expo';
import type { WidgetData } from '../domain/widget';
const module = requireOptionalNativeModule<{ publish: (data: string) => Promise<void> }>('TritonWidget');
export async function publishWidget(data: WidgetData): Promise<void> { await module?.publish(JSON.stringify(data)); }
