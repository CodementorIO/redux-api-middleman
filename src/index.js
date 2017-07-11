import Promise from 'bluebird'
import _ from 'lodash'
import createRequestPromise from './createRequestPromise'

export const CALL_API = Symbol('CALL_API')
export const CHAIN_API = Symbol('CHAIN_API')
export const MAX_REPLAY_TIMES = 2

_.noConflict()

let defaultInterceptor = function({ proceedError, err, replay, getState }) {
  proceedError()
}
let noopDefaultParams = ()=> {
  return {}
}

export default ({
  baseUrl,
  errorInterceptor = defaultInterceptor,
  generateDefaultParams = noopDefaultParams,
  maxReplayTimes = MAX_REPLAY_TIMES
}) => {

  let extractParams = paramsExtractor({ baseUrl })

  return ({ dispatch, getState }) => next => action => {

    if (action[CALL_API]) {
      return dispatch({
        [CHAIN_API]: [
          ()=> action
        ]
      })
    }

    if (! action[CHAIN_API]) {
      return next(action)
    }

    return new Promise((resolve, reject)=> {

      let promiseCreators = action[CHAIN_API].map((createCallApiAction)=> {
        return createRequestPromise({
          generateDefaultParams,
          createCallApiAction,
          getState,
          dispatch,
          errorInterceptor,
          extractParams,
          maxReplayTimes
        })
      })

      let overall = promiseCreators.reduce((promise, createReqPromise)=> {
        return promise.then((body)=> {
          return createReqPromise(body)
        })
      }, Promise.resolve())

      overall.finally(()=> {
        resolve()
      })
      .catch(()=> {
        reject()
      })
    })
  }
}

function paramsExtractor ({ baseUrl }) {
  return (callApi)=> {
    let {
      method,
      path,
      query,
      body,
      url,
      camelizeResponse = true,
      decamelizeRequest = true,
      successType,
      sendingType,
      errorType,
      afterSuccess,
      afterError
    } = callApi

    url = url || `${baseUrl}${path}`

    return {
      method,
      url,
      query,
      body,
      successType,
      sendingType,
      errorType,
      afterSuccess,
      camelizeResponse,
      decamelizeRequest,
      afterError
    }

  }
}
