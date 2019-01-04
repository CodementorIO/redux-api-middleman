[![Build Status](https://travis-ci.org/CodementorIO/redux-api-middleman.svg?branch=master)](https://travis-ci.org/CodementorIO/redux-api-middleman)
[![npm version](https://badge.fury.io/js/redux-api-middleman.svg)](https://www.npmjs.com/package/redux-api-middleman)
[![minzip bundle size](https://img.shields.io/bundlephobia/minzip/redux-api-middleman.svg)](https://www.npmjs.com/package/redux-api-middleman)

# Redux API Middleman

A Redux middleware extracting the asynchronous behavior of sending API requests.

# Usage

## Get Started

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

export const GETTING_MY_INFO = 'GETTING_MY_INFO'
export const GET_MY_INFO_SUCCESS = 'GET_MY_INFO_SUCCESS'
export const GET_MY_INFO_FAILED = 'GET_MY_INFO_FAILED'

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

# Features

- Async to Sync: Abstract the async nature of sending API to make it easier to implement/test
- Universal Rendering Friendly
- Support chaining(successive) API calls
- Side Effect Friendly
- Replay request optionally when failed
- Tweek request/response format when needed

# API Documentation

## Creation

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

### Options

#### `baseUrl`: The base url of api calls(required)

#### `errorInterceptor`(optional)

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
    refreshAccessToken().then((res)=> {
       // here you can pass additional headers if you want
       let headers = {
         'x-access-token': res.token,
       }
       replay({ headers })
     })
  } else {
    proceedError()
  }
}
```

The code above would do the token refreshing whenever err is 401,
and proceed the original error otherwise.

#### `generateDefaultParams`(optional)

A function which takes `({ getState })` and returns an object like this:

```javascript
{
  headers: { 'x-header-key': 'header-val' },
  query: { queryKey: 'query-val' },
  body: { bodyKey: 'body-val' }
}
```

On each request, the object returned by this function would be merged into the request's `header`, `query`, and `body`, respectively.

----

## Usage In Action Creators

In Action Creators, we can use the following code to send a single request:

```javascript
import { CALL_API } from 'redux-api-middleman'

export const ON_REQUEST_SUCCESS = 'ON_REQUEST_SUCCESS'
export const ON_REQUEST_FAILED = 'ON_REQUEST_FAILED'
export const ON_SENDING_REQUEST = 'ON_SENDING_REQUEST'

export function getInfo({ username }) {
  return {
    extraKey: 'extra-val',

    [CALL_API]: {
      method: 'get',
      path: `/users/${username}/info`,
      successType: ON_REQUEST_SUCCESS,
      errorType: ON_REQUEST_FAILED,
      sendingType: ON_REQUEST_FAILED,
      afterSuccess: ({ getState, dispatch, response }) => {
        //...
      },
      afterError: ({ getState, error })=> {
        //...
      }
    }
  }
}
```

In short, just return an action object with `CALL_API`.

### Options

### method(required)
Http verb to use, can be `get`, `post`, `put` or `del`

### path(optional)
Request path to be concated with `baseUrl`

### url
Full url of request, will take precedence over `path` and will ignore `baseUrl`

### camelizeResponse(optional)
Camelize response keys of the request. default to `true`

Transform `{ user_name: 'name' }` to `{ userName: 'name' }`

### decamelizeRequest(optional)
Decamelize request payload keys. default to `true`

Transform `{ userName: 'name' }` to `{ user_name: 'name' }`

### withCredentials(optional)
Enable Access-Control requests or not. default to `true`

### sendingType(optional)
Action type to be dispatched immediately after sending the request

### successType(required)
Action type to be dispatched after the API call success

### errorType(optional)
Action type to be dispatched  after the API call fails

### afterSuccess(optional)
A callback function to be invoked after dispatching the action with type `successType`.
`({ getState, dispatch, response })` would be passed into this callback function.
This is a good place to handle request-related side effects such as route pushing.

### afterError(optional)
A callback function to be invoked after dispatching the action with type `errorType`.
`({ getState, error })` would be passed into this callback function.


## Sending Chaining Requests

To send chaining requests, just return an action with `CHAIN_API`-keyed object like this:

```javascript
import { CALL_API, CHAIN_API } from 'redux-api-middleman'

export const ON_REQUEST_SUCCESS1 = 'ON_REQUEST_SUCCESS1'
export const ON_REQUEST_SUCCESS2 = 'ON_REQUEST_SUCCESS2'

export function getInfo({ username }) {
  return {
    [CHAIN_API]: [
      ()=> {
        return {
          extraKey: 'extra-val',
          [CALL_API]: {
            method: 'get',
            path: `/users/${username}/info`,
            successType: ON_REQUEST_SUCCESS1
          }
        }
      },
      (responseOfFirstReq)=> {
        return {
          [CALL_API]: {
            method: 'get',
            path: `/blogs/${responseOfFirstReq.blogId}`,
            successType: ON_REQUEST_SUCCESS2
          }
        }
      }
    ]
  }
}
```

In the code above, we send an API to `/users/${username}/info` to fetch user info containing a key `blogId`.
After the first request is finished, we then send the second request with the `blogId` returned by server.

---

## Usage In Reducers

During the life cycle of an API call, several types of actions would be dispatched:

### `sendingType` action

After the request has been sent, an action of type `sendingType` would be dispatched immediately.
The action would contain the key-val pairs other than `CALL_API` in the action object.

For example, if our action object looks like this:

```javascript
{
  extraKey1: 'extra-val-1',
  extraKey2: 'extra-val-2',
  [CALL_API]: {
    ...
  }
}
```

then the `sendingType` action would be:

```javascript
{
  type: sendingType,
  extraKey1: 'extra-val-1',
  extraKey2: 'extra-val-2'
}
```

### `successType` action

After the server responds successfully, an action of type `successType` would be dispatched.
The action would contain:

- the key-val pairs other than `CALL_API` in the action object
- an extra `response` key, with its value be the server response

For example, if the server responds with a body like this:

```javascript
{
  responseKey: 'response-val'
}
```

then the `successType` action would be:

```javascript
{
  type: successType,
  extraKey1: 'extra-val-1',
  extraKey2: 'extra-val-2',
  response: {
    responseKey: 'response-val'
  }
}
```

### `errorType` action

After the server responds fails, an action of type `errorType` would be dispatched.
The action would contain:

- the key-val pairs other than `CALL_API` in the action object
- an extra `error` key, with its value be the error object returned by [`axios`](https://github.com/axios/axios)

# LICENCE:
MIT
