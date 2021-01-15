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
const executionTimeMap = {}

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
        if (apiAction.revalidationEnabled) {
          const revalidationKey = _getRevalidationKey(createCallApiAction)
          const lastExecutedTime = executionTimeMap[revalidationKey]
          const hasKey = !!lastExecutedTime
          if (!hasKey) {
            return () => Promise.resolve()
          }
          const now = Math.floor(new Date().getTime() / 1000)
          const shouldNotRevalidate = action.revalidate && (now - lastExecutedTime) > action.revalidate
          if (!shouldNotRevalidate) {
            return () => Promise.resolve()
          }
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
    url,
    params,
    data,
  } = actionObj
  return JSON.stringify({
    method,
    url,
    params,
    data,
  })
}
