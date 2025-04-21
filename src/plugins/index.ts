import type {Server} from '@hapi/hapi';

import validatorPlugin from './validator';

async function plugins(server: Server) {
    await server.register({
        plugin: validatorPlugin,
        options: {},
    });
}

export default plugins;
