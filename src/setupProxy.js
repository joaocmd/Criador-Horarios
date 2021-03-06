/* eslint-disable */
const { createProxyMiddleware } = require('http-proxy-middleware')

module.exports = function(app) {
	app.use(
		'/api',
		createProxyMiddleware({
			target: 'https://fenix.tecnico.ulisboa.pt/',
			changeOrigin: true,
			pathRewrite: {
				'^/api': '/api/fenix/v1'
			}
		})
	)
	app.use(
		'/disciplinas',
		createProxyMiddleware({
			target: 'https://fenix.tecnico.ulisboa.pt/',
			changeOrigin: true,
		})
	)
}