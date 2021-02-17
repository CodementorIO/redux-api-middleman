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
        revalidateDisabled: false,
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
        return createRequestPromise({
          revalidateDisabled: action.revalidateDisabled === undefined ? true : action.revalidateDisabled,
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
