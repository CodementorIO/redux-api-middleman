# Redux API Middleman

[![Build Status](https://travis-ci.org/CodementorIO/redux-api-middleman.svg?branch=master)](https://travis-ci.org/CodementorIO/redux-api-middleman)
[![npm version](https://badge.fury.io/js/redux-api-middleman.svg)](https://badge.fury.io/js/redux-api-middleman)

A Redux middleware extracting the asynchronous behavior of sending API requests.


# Usage:

## Get Started:

- Create the middleware and put into your middleware chain:

```javascript
import { createStore, applyMiddleware } from 'redux'
import createApiMiddleman from 'redux-api-middleman'

let apiMiddleware = createApiMiddleman({
  baseUrl: 'http://api.myapp.com',
})

const store = applyMiddleware(
  [ apiMiddleware ]
)(createStore)()
```

- Use it in your action creators:

```javascript
// user action

import { CALL_API } from 'redux-api-middleman'

export const GETTING_MY_INFO = Symbol('GETTING_MY_INFO')
export const GET_MY_INFO_SUCCESS = Symbol('GET_MY_INFO_SUCCESS')
export const GET_MY_INFO_FAILED = Symbol('GET_MY_INFO_FAILED')

export function getMyInfo() {
  return {
    [CALL_API]: {
      method: 'get',
      path: '/me',
      sendingType: GETTING_MY_INFO,
      successType: GET_CONTRACTS_SUCCESS,
      errorType: GET_MY_INFO_FAILED
    }
  }
}
```

- Handle it in your reducer:

```javascript
// user reducer

import { GET_CONTRACTS_SUCCESS } from 'actions/users'

const defaultState = {}

export default function(state = defaultState, action) {
  switch(action.type) {
    case GET_CONTRACTS_SUCCESS:
      return action.response
    default:
      return state
  }
}

```

The code above would send a `GET` request to `http://api.myapp.com/me`,
when success, it would dispatch an action:

```javascript
{
  type: GET_CONTRACTS_SUCCESS,
  response: { the-camelized-response-body }
}
```

# API Documentation:

## Creation:
## Usage In Action Creators:
## Usave In Reducers:
TODO
