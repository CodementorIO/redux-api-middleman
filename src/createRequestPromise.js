import axios from 'axios'
import Promise from 'yaku/lib/yaku.core'
import _isFunction from 'lodash/isFunction'
import omit from 'lodash/omit'
import { camelizeKeys, decamelizeKeys } from 'humps'

import { CALL_API } from './'
import {
  actionWith,
  addResponseKeyAsSuperAgent,
  generateBody
} from './utils'

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
  return (prevBody)=> {

    let apiAction = createCallApiAction(prevBody)
    let params = extractParams(apiAction[CALL_API])
    let replayTimes = 0

    return new Promise((resolve, reject)=> {

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

        if(params.decamelizeRequest) {
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
        .then((res)=> {
          let resBody = params.camelizeResponse ? camelizeKeys(res.data) : res.data
          dispatchSuccessType(resBody)
          processAfterSuccess(resBody)
          resolve(resBody)
        }, (error)=> {
          // https://github.com/axios/axios#handling-errors
          let serverError = !!error.response || !!error.request

          if (!serverError) {
            console.error(error)
          } else {
            let err = prepareErrorPayload(error)
            function proceedError () {
              handleError(err)
            }
            if (replayTimes === maxReplayTimes) {
              handleError(
                new Error(`reached MAX_REPLAY_TIMES = ${maxReplayTimes}`)
              )
            } else {
              replayTimes += 1
              errorInterceptor({
                proceedError,
                err,
                getState,
                replay: sendRequest
              })
            }
          }
        })

      }
      sendRequest()

      function prepareErrorPayload (error) {
        let res = error.response || {}
        let backwardCompatibleError = addResponseKeyAsSuperAgent(res)
        return backwardCompatibleError
      }

      function handleError (err) {
        dispatchErrorType(err)
        processAfterError(err)
        reject(err)
      }

      function dispatchErrorType (error) {
        if ( params.errorType ) {
          dispatch(actionWith(apiAction, {
            type: params.errorType,
            error
          }))
        }
      }
      function processAfterError (error) {
        if (_isFunction(params.afterError)) {
          params.afterError({ getState })
        }
      }
      function dispatchSuccessType (resBody) {
        dispatch(actionWith(apiAction, {
          type: params.successType,
          response: resBody
        }))
      }
      function processAfterSuccess (response) {
        if (_isFunction(params.afterSuccess)) {
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

