
import Promise from 'bluebird'
import _ from 'lodash'
import superAgent from 'superagent'
import { camelizeKeys, decamelizeKeys } from 'humps'
import { CALL_API } from './'

function actionWith (action, toMerge) {
  let ac = _.cloneDeep(action)
  if (ac[CALL_API]) {
    delete ac[CALL_API]
  }
  return _.merge(ac, toMerge)
}

function createActionPromise ({ actionPayload, dispatch }) {
  return new Promise((resolve)=> {
    dispatch(Object.assign({}, actionPayload))
    resolve()
  })
}

export default function ({
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

    if(!apiAction[CALL_API]) {
      return createActionPromise({
        actionPayload: apiAction,
        dispatch
      })
    }

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

