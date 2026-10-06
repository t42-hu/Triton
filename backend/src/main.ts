// Finish instrumentation setup before loading Nest and its dependencies.
import './observability/instrumentation.js'
await import('./bootstrap.js')
