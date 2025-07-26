## Contribute to Rost

### Step 1: Get a local copy

To start contributing, you'll first need to get your own working copy of Rost that you'll be able to freely make
changes to.

To do this, go to the [Rost repository](https://github.com/LearnRomanian/rost) and
[fork it](https://github.com/LearnRomanian/rost/fork). Forking a repository copies the original repository to your own account.

Once you have forked the repository, clone it to your device:

```
git clone https://github.com/<your github username>/rost.git
```

### Step 2: Set a Rost instance up for yourself

Before you're able to make changes to the bot and see them live, you'll also need to quickly set the bot up for
yourself.

To do this, follow the [setup guide](SETUP.md). It will teach you everything about the setup process.

### Step 3: Set up the test environment.

To work on the bot, you'll need an environment to test its behaviour and any changes you may make.

Rost comes with a script that makes setting test environments up child's play.

To set up an environment, run the following command:

```
bun develop
```

The script will set up a server and invite you to it. It will also generate an accompanying configuration to enable all
of Rost' capabilities on the server.

### Step 4: ✨ Reconnaissance ✨

If all went well, at this point you should have your own modifiable, running copy of Rost, and a complete testing
environment. And just like that, you're ready to develop. Congratulations!

If not, and you've had trouble with any of the previous steps, or the setup process,
[join the Rost support server to get assistance](https://discord.gg/TWdAjkTfah).

### Step 5: Before we get ahead of ourselves...

You are now in the position to make changes and submit them for review.

However, before you do that, you will need to familiarise yourself with the
[Rost style guidelines](STYLE_GUIDELINES.md), which broadly set out how code in the project is written.

## Development checklist

#### #1: Read through your changes

This may sound obvious, but it's easy to assume that what we've written is exactly what we intended, or that our
intentions weren't initially mistaken.

To prevent this, it's best to have a quick check right after writing, checking once more that the code does exactly what
we wanted it to do.

#### #2: Keep your changes coherent and on-point

When updating a music command handler, don't get carried away and end up refactoring a dictionary adapter.

If something else does need changing, note it down and do it afterwards.

#### #3: Keep your pull requests small

If what you're working on requires a lot of changes, try to break up the changes into smaller batches.

Making small(er) PRs as opposed to large ones comes with many benefits, for example:

- They get reviewed and approved a lot faster.
- There's a lot less to reason about and to keep in mind. Focus is concentrated on a few, specific areas.
- The chance that any given change that causes a potential breakage will be overlooked among other normal-looking
  changes is lower.

If you're not sure how you could break your changes
up, [ask other contributors for guidance](https://discord.gg/TWdAjkTfah).

#### #4: Write tests to back your changes up

Having a strong test suite is a massive boost to confidence in the project's correct functioning.

They prove that your changes work as intended, and if anybody ever does accidentally break your feature, those tests
will catch it.

If you're not sure how to test a given change, [other contributors may have an idea](https://discord.gg/TWdAjkTfah).

#### #5: Don't rush your changes, and avoid workarounds

You're in charge of whatever features and changes you're working on, and whilst working on your code, you will gain a
good mental mapping of the areas of the codebase that you touch. You'll therefore be in the best position to get those
changes right the first time around and avoid workarounds.

Doing this will significantly reduce the amount of time other people will have to spend and effort they'll have to put
in to relearn those areas of the codebase when they have to be cleaned up, or workarounds have to be removed.

If a workaround or anything of that sort makes sense to do in a given
moment, [discuss it first](https://discord.gg/TWdAjkTfah).

#### #6: Run the formatter

Ideally, you should have your IDE set up in such a way where it would re-format the file on every change. However, just
to make sure it complies with Biome and the linter ruleset in `biome.json`, run `bun check` before you commit your
changes.
