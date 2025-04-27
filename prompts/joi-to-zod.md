1. **Replace Joi import/require**

    - If you see `const Joi = require('joi')` or `const Joi = require('@hapi/joi')`, remove it and add `import z from 'zod';` at the top.
    - If you see `import Joi from 'joi';`, `import * as Joi from 'joi';`, `import Joi from '@hapi/joi';` or `import * as Joi from '@hapi/joi';`, replace it with `import z from 'zod';`.

2. **Transform every Joi schema call inside the placeholder**

    - `Joi.string()` → `z.string()`
    - `Joi.number()` → `z.number()`
    - `Joi.boolean()` → `z.boolean()`
    - `Joi.date()` → `z.date()`
    - `Joi.array().items(X)` → `z.array(X)`
    - `Joi.object({...})` → `z.object({...})`

3. **Map validators one‑to‑one**

    - `.min(n)` / `.max(n)` / `.length(n)` → same on strings, numbers, arrays
    - `.greater(n)` → `.gt(n)`, `.less(n)` → `.lt(n)`
    - `.integer()` → `.int()`, `.precision(p)` → use `.step(1 / 10**p)` or a `.refine(...)`
    - `.allow(null)` → `.nullable()`
    - `.required()` → _no change_ (Zod is required by default); if you find `.required(false)`, replace with `.optional()`
    - `.default(val)` → `.default(val)`
    - `.valid(a, b, c)` → `z.enum([…])` for literal sets, otherwise `.refine(v => [a,b,c].includes(v))`
    - `.invalid(x)` → `.refine(v => v !== x, { message: '…' })`
    - `.pattern(regex, name?)` → see **Regex note**
    - `.email()` → `.email()`, `.uri()` → `.url()`, `.uuid()` → `.uuid()`
    - `.insensitive()` → incorporate `i` flag in the rebuilt `RegExp`
    - `.unknown(true)` → `.passthrough()`, `.unknown(false)` → `.strict()`

4. **Edge cases & complex schemas**

    - **Alternatives/Unions**: `Joi.alternatives().try(A, B)` → `z.union([A, B])`
    - **Conditional `.when()`** → convert to `z.preprocess` or `.refine`
    - **`.concat()`** → `.merge()`
    - **Lazy**: `Joi.lazy(fn)` → `z.lazy(fn)`
    - **Custom messages**: port `Joi.messages()` or `.error()` into Zod’s `.refine`/`.superRefine` or second‐arg options
    - **External transforms**: use Zod’s `.transform()` or async `.superRefine(async …)`
    - **Date formats**: map `Joi.date().iso()` → either `z.date()` with parsing or `z.string().refine(...)`
    - **Ports**: map `Joi.number().port()` → `.int().refine(n => n>=0 && n<=65535)`
    - **Schema‐level prefs**: replace `schema.options({ presence:'required' })` with explicit `.optional()`/`.strict()`

5. **Regex transformation note**

    - Extract the `.source` and `.flags` from any Joi‐pattern:
        ```js
        // Joi
        Joi.string().pattern(/^foo\d+$/i, 'foo-code');
        // becomes
        z.string().regex(new RegExp('^foo\\d+$', 'i'), {message: 'foo-code'});
        ```
    - Always reconstruct with `new RegExp(source, flags)` and pass an options object for the message.
