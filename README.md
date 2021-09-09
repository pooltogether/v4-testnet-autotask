# PoolTogether V3 Reward Defender Autotask

This project implements an Autotask for [OpenZeppelin Defender](https://defender.openzeppelin.com/) that rewards the PoolTogether V3 prize strategies automatically.

# Setup

1. Copy `.envrc.example` to `.envrc`
2. Update `.envrc` with the appropriate variables
3. Run `direnv allow`.  See [direnv](https://direnv.net)
4. Run `yarn update` to update the autotasks.

# Usage

First build the project:

```sh
$ yarn build
```

This will create:
 - `dist/rinkeby-build.js`
 - `dist/ropsten-build.js`

Copy the contents of those files into their respectives Autotasks in OpenZeppelin Defender.

# Running locally

You can use the CLI as well to test out the task:

```
$ yarn cli
```

There's a precooked command called `rinkeby` that uses env vars.

First setup the vars:

```
$ cp .envrc.example .envrc
```

Now allow direnv

```
$ direnv allow
```

Set the vars to what you need, then run:

```
$ yarn reward [network]
```

Where [network] is `rinkeby`, `ropsten` or `polygon`