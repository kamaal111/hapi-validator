import type {Server} from '@hapi/hapi';
import Joi from 'joi';

const GreetingQuery = Joi.object({name: Joi.string().optional()}).unknown(true);

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
        options: {validate: {params: Joi.object({id: Joi.string()})}},
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
