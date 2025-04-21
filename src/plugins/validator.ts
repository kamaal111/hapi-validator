import type {Plugin} from '@hapi/hapi';

type Options = {};

const validatorPlugin: Plugin<Options> = {
    register(server, options) {},
    name: 'validatorPlugin',
};

export default validatorPlugin;
