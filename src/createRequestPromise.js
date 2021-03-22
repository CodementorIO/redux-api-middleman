import axios from 'axios'
import Promise from 'es6-promise'
import omit from 'object.omit'
import { camelizeKeys, decamelizeKeys } from 'humps'

import { CALL_API } from './'
import { actionWith, generateBody, window } from './utils'
import log from './log'

function isFunction (v) {
  return typeof v === 'function'
}
const lastRevalidateTimeMap = {}

export default function ({
  timeout,
  generateDefaultParams,
  createCallApiAction,
  getState,
  dispatch,
  errorInterceptor,
  extractParams,
  maxReplayTimes,
  revalidateDisabled = false
}) {
  return (prevBody) => {
    const apiAction = createCallApiAction(prevBody)
    const params = extractParams(apiAction[CALL_API])
    let replayTimes = 0

    const now = Math.floor(new Date().getTime() / 1000)
    if (!!params.revalidate && !!window && !revalidateDisabled) {
      const revalidationKey = _getRevalidationKey(params)
      const lastRevalidateTime = lastRevalidateTimeMap[revalidationKey] || 0
      if (params.revalidate === 'never' && !!lastRevalidateTime) {
        return () => Promise.resolve()
      }
      if (Number.isInteger(params.revalidate)) {
        const shouldNotRevalidate = (now - lastRevalidateTime) < params.revalidate
        if (shouldNotRevalidate) {
          return () => Promise.resolve()
        }
      }
      lastRevalidateTimeMap[revalidationKey] = now
    }

    return new Promise((resolve, reject) => {
      function sendRequest (interceptorParams = {}) {
        if (params.sendingType) {
          dispatch(actionWith(apiAction, { type: params.sendingType }))
        }

        const defaultParams = getExtendedParams()

        let queryObject = Object.assign({}, defaultParams.query, params.query)
        let sendObject = Object.assign({}, defaultParams.body, params.body)
        const headersObject = Object.assign({},
          defaultParams.headers,
          params.headers,
          interceptorParams.headers
        )

        if (params.decamelizeRequest) {
          queryObject = decamelizeKeys(queryObject)
          sendObject = decamelizeKeys(sendObject)
        }

        const omitKeys = params.method.toLowerCase() === 'get' ? ['data'] : []

        const config = omit({
          headers: headersObject,
          method: params.method,
          url: params.url,
          params: queryObject,
          data: generateBody({ headersObject, sendObject }),
          withCredentials: params.withCredentials,
          timeout
        }, omitKeys)

        axios(config)
          .then((res) => {
            const resBody = params.camelizeResponse ? camelizeKeys(res.data) : res.data
            dispatchSuccessType(resBody)
            processAfterSuccess(resBody)
            resolve(resBody)
          }).catch((error) => {
          // https://github.com/axios/axios#handling-errors
            const serverError = !!error.response || !!error.request

            if (!serverError) {
              return handleOperationError(error)
            }

            if (replayTimes === maxReplayTimes) {
              return handleError(
                new Error(`reached MAX_REPLAY_TIMES = ${maxReplayTimes}`)
              )
            }

            const err = prepareErrorPayload({ error, camelize: params.camelizeResponse })
            replayTimes += 1
            errorInterceptor({
              proceedError: () => handleError(err),
              err,
              getState,
              replay: sendRequest
            })
          })
      }

      sendRequest()

      function handleOperationError (error) {
        log.error(error)
        reject(error)
      }

      function prepareErrorPayload ({ error, camelize }) {
        const res = error.response || {}
        res.config = error.config
        if (camelize) {
          res.data = camelizeKeys(res.data)
        }
        return res
      }

      function handleError (err) {
        dispatchErrorType(err)
        processAfterError(err)
        reject(err)
      }

      function dispatchErrorType (error) {
        if (params.errorType) {
          dispatch(actionWith(apiAction, {
            type: params.errorType,
            error
          }))
        }
      }
      function processAfterError (error) {
        if (isFunction(params.afterError)) {
          params.afterError({ getState, dispatch, error })
        }
      }
      function dispatchSuccessType (resBody) {
        dispatch(actionWith(apiAction, {
          type: params.successType,
          response: resBody
        }))
      }
      function processAfterSuccess (response) {
        if (isFunction(params.afterSuccess)) {
          params.afterSuccess({ getState, dispatch, response })
        }
      }
      function getExtendedParams () {
        let { headers, body, query } = generateDefaultParams({ getState })
        headers = headers || {}
        body = body || {}
        query = query || {}
        return { headers, body, query }
      }
    })
  }
}

function _getRevalidationKey (actionObj) {
  const {
    method,
    path,
    url,
    params,
    data
  } = actionObj
  return JSON.stringify({
    method,
    path,
    url,
    params,
    data
  })
}
