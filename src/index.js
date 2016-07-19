import superAgent from 'superagent'
import Promise from 'bluebird'
import _ from 'lodash'
import { camelizeKeys } from 'humps'

export const CALL_API = Symbol('CALL_API')
export const CHAIN_API = Symbol('CHAIN_API')

_.noConflict()

let defaultInterceptor = function({ proceedError, err, replay, getState }) {
  proceedError()
}

export default ({ errorInterceptor = defaultInterceptor, baseUrl }) => {
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
          createCallApiAction,
          getState,
          dispatch,
          errorInterceptor,
          extractParams
        })
      })

      let overall = promiseCreators.reduce((promise, createReqPromise)=> {
        return promise.then((body)=> {
          return createReqPromise(body)
        })
      }, Promise.resolve())

      overall.finally(()=> {
        resolve()
      }).catch(()=> {})
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
  createCallApiAction,
  getState,
  dispatch,
  errorInterceptor,
  extractParams
}) {
  return (prevBody)=> {

    let apiAction = createCallApiAction(prevBody)
    let params = extractParams(apiAction[CALL_API])


    return new Promise((resolve, reject)=> {
      function sendRequest () {
        if (params.sendingType) {
          dispatch(actionWith(apiAction, { type: params.sendingType }))
        }
        let request = superAgent[params.method](params.url)
        if (_.isFunction(request.withCredentials)) {
          request = request.withCredentials()
        }

        request
          .send(params.body)
          .query(params.query)
          .end((err, res)=> {
            function proceedError () {
              handleError(err)
            }
            if (err) {
              errorInterceptor({
                proceedError,
                err,
                getState,
                replay: sendRequest
              })
            } else {
              let resBody = params.camelizeResponse ? camelizeKeys(res.body) : res.body
              dispatchSuccessType(resBody)
              processAfterSuccess()
              resolve(resBody)
            }
          })
      }
      sendRequest()

      function handleError (err) {
        dispatchErrorType(err)
        processAfterError()
        reject()
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
      function processAfterSuccess () {
        if (_.isFunction(params.afterSuccess)) {
          params.afterSuccess({ getState, dispatch })
        }
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
      afterError
    }

  }
}
