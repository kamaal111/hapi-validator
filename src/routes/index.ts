import type {Server} from '@hapi/hapi';
import z from "zod";

const GreetingQuery = z.object({name: z.string().optional()}).passthrough().optional();

function routes(server: Server) {
    server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
            return 'Hello World!';
        },
    });
    server.route({
        method: 'GET',
        path: '/users/{id}',
        options: {validate: {params: z.object({id: z.string()}).optional()}},
        handler: (request, h) => {
            return 'Hello World!';
        },
    });
    server.route({
        method: 'GET',
        path: '/greeting',
        options: {validate: {query: GreetingQuery}},
        handler: (request, h) => {
            return `Hello ${request.query.name ?? 'World'}!`;
        },
    });
}

export default routes;
