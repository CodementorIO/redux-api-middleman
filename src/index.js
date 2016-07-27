import superAgent from 'superagent'
import Promise from 'bluebird'
import _ from 'lodash'
import { camelizeKeys, decamelizeKeys } from 'humps'

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

export default ({ errorInterceptor = defaultInterceptor, baseUrl, generateDefaultParams = noopDefaultParams, maxReplayTimes = MAX_REPLAY_TIMES }) => {

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
      .catch(()=> {})
    })
  }
}

function actionWith (action, toMerge) {
  let ac = _.cloneDeep(action)
  if (ac[CALL_API]) {
    delete ac[CALL_API]
  }
  return _.merge(ac, toMerge)
}

function createRequestPromise ({
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
      function sendRequest () {
        if (params.sendingType) {
          dispatch(actionWith(apiAction, { type: params.sendingType }))
        }
        let defaultParams = getExtendedParams()
        let request = superAgent[params.method](params.url)
        if (_.isFunction(request.withCredentials)) {
          request = request.withCredentials()
        }

        let queryObject = Object.assign({}, defaultParams.query, params.query)
        let sendObject = Object.assign({}, defaultParams.body, params.body)

        if(params.decamelizeRequest) {
          queryObject = decamelizeKeys(queryObject)
          sendObject = decamelizeKeys(sendObject)
        }

        request
          .set(defaultParams.headers)
          .query(queryObject)
          .send(sendObject)
          .end((err, res)=> {
            function proceedError () {
              handleError(err)
            }
            if (err) {

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

            } else {
              let resBody = params.camelizeResponse ? camelizeKeys(res.body) : res.body
              dispatchSuccessType(resBody)
              processAfterSuccess(resBody)
              resolve(resBody)
            }
          })
      }
      sendRequest()

      function handleError (err) {
        dispatchErrorType(err)
        processAfterError()
        reject(err)
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
        if (_.isFunction(params.afterError)) {
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
        if (_.isFunction(params.afterSuccess)) {
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
