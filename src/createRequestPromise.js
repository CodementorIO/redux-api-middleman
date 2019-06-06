import axios from 'axios'
import Promise from 'yaku/lib/yaku.core'
import omit from 'object.omit'
import { camelizeKeys, decamelizeKeys } from 'humps'

import { CALL_API } from './'
import { actionWith, generateBody } from './utils'
import log from './log'

function isFunction (v) {
  return typeof v === 'function'
}

export default function ({
  timeout,
  generateDefaultParams,
  createCallApiAction,
  getState,
  dispatch,
  errorInterceptor,
  extractParams,
  maxReplayTimes
}) {
  return (prevBody) => {
    let apiAction = createCallApiAction(prevBody)
    let params = extractParams(apiAction[CALL_API])
    let replayTimes = 0

    return new Promise((resolve, reject) => {
      function sendRequest (interceptorParams = {}) {
        if (params.sendingType) {
          dispatch(actionWith(apiAction, { type: params.sendingType }))
        }

        let defaultParams = getExtendedParams()

        let queryObject = Object.assign({}, defaultParams.query, params.query)
        let sendObject = Object.assign({}, defaultParams.body, params.body)
        let headersObject = Object.assign({},
          defaultParams.headers,
          params.headers,
          interceptorParams.headers
        )

        if (params.decamelizeRequest) {
          queryObject = decamelizeKeys(queryObject)
          sendObject = decamelizeKeys(sendObject)
        }

        let omitKeys = params.method.toLowerCase() === 'get' ? ['data'] : []

        let config = omit({
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
            let resBody = params.camelizeResponse ? camelizeKeys(res.data) : res.data
            dispatchSuccessType(resBody)
            processAfterSuccess(resBody)
            resolve(resBody)
          }).catch((error) => {
          // https://github.com/axios/axios#handling-errors
            let serverError = !!error.response || !!error.request

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
        let res = error.response || {}
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
