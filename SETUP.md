## Setup Rost

### Step 0: Download Rost.

You can always get the latest release of Rost [here](https://github.com/LearnRomanian/rost/releases/latest).

To download the release, simply download your archive of choice (.zip, .tar.gz) under 'Assets', then unzip the files.

### Step 1: Let's start.

To get a minimal instance of Rost up and running, you only need to have [Bun](https://bun.sh/docs/installation)
installed.

Before you can start the bot, you will need to create an `.env` file storing your bot's Discord token:

```
DISCORD_TOKEN=<token goes here>
```

To start the bot:

```
bun start
```

If everything ran smoothly, you should now have a live Rost instance!

> Note: You are running a minimal instance. A large chunk of Rost' features will be unavailable yet. The rest of the
> setup guide will teach you how to enable (or disable!) each piece of functionality one-by-one.

### Step 2: Configuring the database

> Without configuration, Rost will store its documents in memory, and any documents created during the bot's lifecycle
> will be lost on restart.
>
> If you'd prefer that your data be kept, you will need to configure Rost to use a database.
>
> [*If not, feel free to skip to the next section.*](#step-3-configuring-a-cache-database)

Rost comes with a selection of NoSQL databases to use out of the box, giving you the flexibility of deciding which
solution you're going with.

- <details>
    <summary>MongoDB (<a href="https://mongodb.com/products/platform/atlas-database">Official Website</a>, <a href="https://mongodb.com/docs/manual/administration/install-community/">Setup Guide</a>)</summary>

  To use MongoDB with Rost, add the following credentials to your `.env` file:

    ```
    DATABASE_SOLUTION=mongodb # Tell Rost to use MongoDB as its database driver.  
    # MONGODB_USERNAME=       # (optional for unsecured instances) Username for authorisation.
    # MONGODB_PASSWORD=       # (optional for unsecured instances) Password for authorisation.
    MONGODB_HOST=127.0.0.1    # Address of your MongoDB instance. 
    MONGODB_PORT=27017        # Port your MongoDB instance is operating at. (MongoDB uses 27017 by default)
    MONGODB_DATABASE=rost     # Name of your database. 
    ```
  </details>
- <details>
    <summary>RavenDB (<a href="https://ravendb.net">Official Website</a>, <a href="https://ravendb.net/docs/article-page/6.0/csharp/start/installation/setup-wizard">Setup Guide</a>)</summary>

  To use RavenDB with Rost, add the following credentials to your `.env` file:

    ```
    DATABASE_SOLUTION=ravendb # Tell Rost to use RavenDB as its database driver. 
    RAVENDB_HOST=127.0.0.1    # Address of your RavenDB instance.
    RAVENDB_PORT=8080         # Port your RavenDB instance is operating at. (RavenDB uses 8080 by default)
    RAVENDB_DATABASE=rost     # Name of your database.
    # RAVENDB_SECURE=         # (optional for unsecured instances) Whether to establish a secure connection.
                              # If true, Rost will attempt to read a `.cert.pfx` file from the root directory.  
    ```
  </details>
- <details>
    <summary>CouchDB (<a href="https://couchdb.apache.org">Official Website</a>, <a href="https://docs.couchdb.org/en/stable/install/index.html">Setup Guide</a>)</summary>

  To use CouchDB with Rost, add the following credentials to your `.env` file:

    ```
    DATABASE_SOLUTION=couchdb # Tell Rost to use CouchDB as its database driver.
    COUCHDB_USERNAME=admin    # Username for authorisation.
    COUCHDB_PASSWORD=password # Password for authorisation.
    COUCHDB_HOST=127.0.0.1    # Address of your CouchDB instance.
    COUCHDB_PORT=5984         # Port your CouchDB instance is operating at. (CouchDB uses 5984 by default)
    COUCHDB_DATABASE=rost     # Name of your database.
    ```
  </details>
- <details>
    <summary>RethinkDB (<a href="https://rethinkdb.com/">Official Website</a>, <a href="https://rethinkdb.com/docs/install/">Setup Guide</a>)</summary>

  To use RethinkDB with Rost, add the following credentials to your `.env` file:

    ```
    DATABASE_SOLUTION=rethinkdb # Tell Rost to use RethinkDB as its database driver.
    # RETHINKDB_USERNAME=       # (optional for unsecured instances) Username for authorisation.
    # RETHINKDB_PASSWORD=       # (optional for unsecured instances) Password for authorisation.
    RETHINKDB_HOST=127.0.0.1    # Address of your RethinkDB instance.
    RETHINKDB_PORT=28015        # Port your RethinkDB instance is operating at. (RethinkDB uses 28015 by default)
    RETHINKDB_DATABASE=rost     # Name of your database.
    ```
  </details>
- <details>
    <summary>In-memory database</summary>

  To tell Rost you're fine with running an in-memory database, add the following record to your `.env` file:

    ```
    DATABASE_SOLUTION=none # Tell Rost to store documents in memory.
    ```

</details>

> Note: Rost follows each database's native storage conventions when storing documents, making it predictable how your
> data will look regardless of the database you choose to go with.

### Step 3: Configuring the audio node

> The music service needs a Lavalink node to operate.
>
> If you'd like Rost to play music, you will need to add credentials of a Lavalink node to connect to.
>
> [*If not, feel free to skip to the next section.*](#step-5-configuring-language-integrations)

You do not necessarily need to set up a Lavalink node yourself; there are public nodes out there that you can connect to
and use. However, if you are looking for high reliability, it would usually be a good idea to host a node yourself.

The credentials to add to `.env` for Lavalink are as follows:

```
LAVALINK_HOST=127.0.0.1           # Address of your Lavalink instance.
LAVALINK_PORT=2333                # Port your Lavalink instance operates at.
LAVALINK_PASSWORD=youshallnotpass # Password for authorisation.
```

### That's all!

Hopefully, once you've reached this section, you would have a fully configured instance of Rost to run for yourself.

If that's the case, congratulations, and welcome to the world of Rost!
