import Promise from 'es6-promise'
import createRequestPromise from './createRequestPromise'
import { paramsExtractor } from './utils'

export const CALL_API = Symbol('CALL_API')
export const CHAIN_API = Symbol('CHAIN_API')
export const DEFAULT_MAX_REPLAY_TIMES = 2
export const DEFAULT_TIMEOUT = 20000 // ms

const defaultInterceptor = function ({ proceedError, err, replay, getState }) {
  proceedError()
}
const noopDefaultParams = () => {
  return {}
}
const lastRevalidateTimeMap = {}

export default ({
  baseUrl,
  timeout = DEFAULT_TIMEOUT,
  errorInterceptor = defaultInterceptor,
  generateDefaultParams = noopDefaultParams,
  maxReplayTimes = DEFAULT_MAX_REPLAY_TIMES
}) => {
  const extractParams = paramsExtractor({ baseUrl })

  return ({ dispatch, getState }) => next => action => {
    if (action[CALL_API]) {
      return dispatch({
        [CHAIN_API]: [
          () => action
        ]
      })
    }

    if (!action[CHAIN_API]) {
      return next(action)
    }

    return new Promise((resolve, reject) => {
      const promiseCreators = action[CHAIN_API].map((createCallApiAction) => {
        const apiAction = createCallApiAction()[CALL_API]
        const now = Math.floor(new Date().getTime() / 1000)
        if (!!apiAction.revalidate) {
          const revalidationKey = _getRevalidationKey(apiAction)
          const lastRevalidateTime = lastRevalidateTimeMap[revalidationKey] || 0
          if(apiAction.revalidate === 'never' && !!lastRevalidateTime){
            return () => Promise.resolve()
          }
          if (Number.isInteger(apiAction.revalidate)) {
            const shouldNotRevalidate = (now - lastRevalidateTime) < apiAction.revalidate
            if (shouldNotRevalidate) {
              return () => Promise.resolve()
            }
          }
          lastRevalidateTimeMap[revalidationKey] = now
        }

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

      const overall = promiseCreators.reduce((promise, createReqPromise) => {
        return promise.then(createReqPromise)
      }, Promise.resolve())

      overall.finally(resolve).catch(reject)
    })
  }
}

function _getRevalidationKey(actionObj) {
  const {
    method,
    path,
    url,
    params,
    data,
  } = actionObj
  return JSON.stringify({
    method,
    path,
    url,
    params,
    data,
  })
}
