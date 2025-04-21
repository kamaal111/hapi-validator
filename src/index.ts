import Hapi from '@hapi/hapi';

import routes from './routes';
import plugins from './plugins';

async function main() {
    const server = Hapi.server({port: 3000, host: 'localhost'});

    await plugins(server);
    routes(server);

    await server.start();
    console.log('Server running on %s', server.info.uri);
}

process.on('unhandledRejection', err => {
    console.log(err);
    process.exit(1);
});

main();
