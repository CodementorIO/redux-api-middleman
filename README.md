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

# Features:

- Async to Sync: Abstract the async nature of sending API to make it easier to implement/test
- Universal Rendering Friendly
- Support chaining(successive) API calls
- Side Effect Friendly
- Replay request optionally when failed
- Tweek request/response format when needed

# API Documentation:

## Creation:

A middleware can be created like this:

```javascript
import apiMiddleware from 'redux-api-middleman'

apiMiddleware({
  baseUrl: 'https://api.myapp.com',
  errorInterceptor: ({ err, proceedError, replay, getState })=> {
    // handle replay here
  },
  generateDefaultParams: ({ getState })=> {
    return {
      headers: { 'X-Requested-From': 'my-killer-app' },

    }
  },
  maxReplayTimes: 5
})
```

### Options:

Required ones:

- `baseUrl`: The base url of api calls

Optional ones:

- `errorInterceptor`:

When provided, this function would be invoked whenever an API call fails.
The function signature looks like this:

```javascript
({ err, proceedError, replay, getState })=> {

}
```

Where:

`err` is the error object returned by [`superagent`](https://visionmedia.github.io/superagent/),
`replay()` can be used to replay the request with the same method/parameters,
`proceedError()` can be used to proceed error to reducers

For example, to refresh access token when server responds 401:

```javascript
({ err, proceedError, replay, getState })=> {
  if(err.status === 401) {
    refreshAccessToken()
      .then(()=> { replay() })
  } else {
    proceedError()
  }
}
```

The code above would do the token refreshing whenever err is 401,
and proceed the original error otherwise.


## Usage In Action Creators:
## Usage In Reducers:
TODO

# LICENCE:
MIT
