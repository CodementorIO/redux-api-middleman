import { paramsExtractor } from '../src/utils'

describe('Utils', () => {
  describe('#paramsExtractor', () => {
    let params
    const baseUrl = 'http://base'
    const callApi = {
      path: '/path'
    }
    beforeEach(() => {
      params = paramsExtractor({ baseUrl })(callApi)
    })
    it('sets `url` with prefix baseUrl', () => {
      expect(params.url).toEqual(
        `${baseUrl}${callApi.path}`
      )
    })
    it('defaults to set withCredentials to ture', () => {
      expect(params.withCredentials).toEqual(true)
    })
  })
})
