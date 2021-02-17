import qs from 'qs'
import { CALL_API } from './'

export const log = console

export function actionWith (action, toMerge) {
  const { [CALL_API]: api, ...extra } = action
  return {
    ...extra,
    ...toMerge
  }
}

function _isUrlencodedContentType (headersObject) {
  const contentTypeKey = Object.keys(headersObject).find(
    key => key.toLowerCase() === 'content-type'
  )
  if (!contentTypeKey) {
    return false
  }
  return headersObject[contentTypeKey] === 'application/x-www-form-urlencoded'
}

export function generateBody ({ headersObject, sendObject }) {
  const isUrlencoded = _isUrlencodedContentType(headersObject)
  return isUrlencoded ? qs.stringify(sendObject) : sendObject
}

export function paramsExtractor ({ baseUrl }) {
  return (callApi) => {
    let {
      method,
      path,
      query,
      body,
      headers,
      url,
      revalidate,
      camelizeResponse = true,
      decamelizeRequest = true,
      withCredentials = true,
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
      headers,
      successType,
      sendingType,
      errorType,
      afterSuccess,
      revalidate,
      camelizeResponse,
      decamelizeRequest,
      withCredentials,
      afterError
    }
  }
}

const _window = typeof window === 'undefined' ? null : window

export { _window as window }

