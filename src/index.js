import Promise from 'yaku/lib/yaku.core'
import createRequestPromise from './createRequestPromise'

export const CALL_API = Symbol('CALL_API')
export const CHAIN_API = Symbol('CHAIN_API')
export const DEFAULT_MAX_REPLAY_TIMES = 2
export const DEFAULT_TIMEOUT = 20000 //ms

let defaultInterceptor = function({ proceedError, err, replay, getState }) {
  proceedError()
}
let noopDefaultParams = ()=> {
  return {}
}

export default ({
  baseUrl,
  timeout = DEFAULT_TIMEOUT,
  errorInterceptor = defaultInterceptor,
  generateDefaultParams = noopDefaultParams,
  maxReplayTimes = DEFAULT_MAX_REPLAY_TIMES
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
          timeout,
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
      .catch((e)=> {
        reject(e)
      })
    })
  }
}

export function paramsExtractor ({ baseUrl }) {
  return (callApi)=> {
    let {
      method,
      path,
      query,
      body,
      headers,
      url,
      camelizeResponse = true,
      decamelizeRequest = true,
      withCredentials = true,
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
      headers,
      successType,
      sendingType,
      errorType,
      afterSuccess,
      camelizeResponse,
      decamelizeRequest,
      withCredentials,
      afterError
    }

  }
}
