
import Promise from 'yaku/lib/yaku.core'
import qs from 'query-string'
import _merge from 'lodash/merge'
import _cloneDeep from 'lodash/cloneDeep'
import _isFunction from 'lodash/isFunction'
import omit from 'lodash/omit'

import { camelizeKeys, decamelizeKeys } from 'humps'
import { CALL_API } from './'

import axios from 'axios'

function actionWith (action, toMerge) {
  let ac = _cloneDeep(action)
  if (ac[CALL_API]) {
    delete ac[CALL_API]
  }
  return _merge(ac, toMerge)
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

        let configs = omit({
          headers: headersObject,
          method: params.method,
          url: params.url,
          params: queryObject,
          data: generateBody({ headersObject, sendObject }),
          withCredentials: params.withCredentials,
          timeout
        }, omitKeys)

        axios(configs)
        .then((res)=> {
          let resBody = params.camelizeResponse ? camelizeKeys(res.data) : res.data
          dispatchSuccessType(resBody)
          processAfterSuccess(resBody)
          resolve(resBody)
        })
        .catch((error)=> {
          let err = prepareErroPayload(error)
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
        })

      }
      sendRequest()

      function prepareErroPayload (error) {
        let res = error.response || {}
        let backwardCompatibleError = addResponseKeyAsSuperAgent(res)
        return backwardCompatibleError
      }

      function addResponseKeyAsSuperAgent (res) {
        return Object.assign({}, res, {
          response: {
            body: res.data
          }
        })
      }

      function handleError (err) {
        dispatchErrorType(err)
        processAfterError()
        reject(new Error(err))
      }

      function dispatchErrorType (err) {
        if ( params.errorType ) {
          dispatch(actionWith(apiAction, {
            type: params.errorType,
            error: err
          }))
        }
      }
      function processAfterError () {
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

      function isUrlencodedContentType (headersObject) {
        let contentTypeKey = Object.keys(headersObject).find(
          key => key.toLowerCase() === 'content-type'
        )
        if (!contentTypeKey) {
          return false
        }
        return headersObject[contentTypeKey] === 'application/x-www-form-urlencoded'
      }

      function generateBody ({ headersObject, sendObject }) {
        const isUrlencoded = isUrlencodedContentType(headersObject)
        return isUrlencoded ? qs.stringify(sendObject) : sendObject
      }
    })
  }
}

