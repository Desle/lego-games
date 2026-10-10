import { getEnvironment } from './shared/environment/environment.ts'

const environment = getEnvironment()

console.log(`Started in ${environment.name}`)
