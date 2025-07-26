## Rost Style Guidelines

> Good to know: Time is stored and measured in milliseconds unless required otherwise.

### Language and naming conventions

#### Use British English spelling.

The codebase is written from start to end using British English spellings. To maintain the same degree of consistency, new code should also be written using British spelling.

If you do not know British English spelling, and you don't have much time to learn them, **you can submit your changes anyway**. A reviewer will help out in updating the spellings to match the rest of the codebase.

However, if you have a spare moment to learn the differences, please do.

> ❌ `color`, `initialize`, `license`, `journaling`
> 
> ✅ `colour`, `initialise`, `licence`, `journalling`

#### Use complete forms of words; Do not shorten words just for the sake of it.

Acronyms are fine, the abbreviation 'id' is also fine.

> ❌ `req`, `tx`, `diag`, `src`, `cert`, `conf`, ...
> 
> ✅ `request`, `transaction`, `diagnostics`, `source`, `certificate`, `configuration`, ...
> 
> 👌 `url`, `http`, `ip`, `tls`\
> 👌 `id`

### Transparency

#### Use namespacing when importing libraries.

Keeping external APIs under an alias makes it always abundantly clear where a given symbol comes from.

Accessing all external APIs via a namespace also eliminates the need for future gymnastics with naming when the names of two imported members do, predictably, conflict.

> ❌
> ```typescript
> import { Server as CarbonServer, ServerOptions as CarbonServerOptions } from "carbon";
> import { Server as HydrogenServer, ServerOptions as HydrogenServerOptions } from "hydrogen";
> 
> new CarbonServer({ options: new CarbonServerOptions() });
> new HydrogenServer({ options: new HydrogenServerOptions() });
> ```
> 
> ✅
> ```typescript
> import * as carbon from "carbon";
> import * as hydrogen from "hydrogen";
> 
> new carbon.Server({ options: new carbon.ServerOptions(...) });
> new hydrogen.Server({ options: new hydrogen.ServerOptions(...) });
> ```

### Strictness

#### Use non-coalescing operators

Using the non-coalescing `===`, `??` over `==`, `||` prevents errors arising from oversights in type coalescing.

Unless it makes sense in a given scenario to use an operator that does this kind of coalescing, whether to reduce verbosity or otherwise, use the non-coalescing operators instead.

> ❌ `id == 123`, `option || fallback`
> 
> ✅ `id === 123`, `option ?? fallback`

#### Use `undefined` over `null`

To represent missing values, use `undefined`.

`null` is fine to use *alongside* `undefined` when making a distinction such as 'this value does not exist' and 'delete this value'.

> ❌ `async getUser(): Promise<User | null>`
> 
> ✅ `async getUser(): Promise<User | undefined>`
>
> 👌 `async updateProfile({ title?: string | null }): Promise<void>;`

### Keeping code close to JS

#### Do not use TypeScript's accessibility keywords; Use `#` to declare private API members.

> ❌ `private readonly property: string;`
> 
> ✅ `readonly #property: string;`

#### Do not use TypeScript's `enum` keyword.

Instead, use a union type of strings.

> ❌
> ```typescript
> enum MentionTypes {
>   User,
>   Channel,
>   Role,
> }
> 
> function mention(id: string, { type }: { type: MentionTypes }): string { ... }
> 
> mention(id, { type: MentionTypes.User });
> ```
> 
> ✅
> ```typescript
> type MentionType = "user" | "channel" | "role";
> 
> function mention(id: string, { type }: { type: MentionType }): string { ... }
> 
> mention(id, { type: "user" });
> ```

### Idiosyncratic conventions

#### Use `[]` when accessing tuples, `.at()` when accessing basic arrays.

This originated as a preference as it's a nice and relatively fault-free way to make a distinction between tuple accesses and basic array accesses.

> ```typescript
> const tuple: [first: string, second: number, third: boolean] = ['string', 1, true];
> const array: number[] = [10, 20, 30, 40, 50];
> ```
> 
> ❌
> ```typescript
> tuple.at(0);
> array[0];
> ```
> 
> ✅
> ```typescript
> tuple[0];
> array.at(0);
> ```

#### Use `+= 1` and `-= 1` over `++` and `--`.

These are more in line with other similar operations such as `*=`, `/=` and `**=`.

> ❌ `value++`, `value--`
> 
> ✅ `value += 1`, `value -= 1`
