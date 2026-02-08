const request = require('supertest');
const app = require('../app');

describe('App basics', () => {
    test('GET /non-existent returns 404 JSON', async () => {
        const res = await request(app).get('/nope');
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({
            result: false,
            data: null
        });
    });
});
