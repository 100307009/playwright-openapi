import { ENDPOINTS } from '../spec/endpoints';
import { Scenario } from './types';

export const userGetScenarios: Scenario[] = [
  {
    name: 'login with valid credentials matches the documented string schema',
    path: ENDPOINTS.user.login,
    queryParams: { username: '{{validUsername}}', password: '{{validPassword}}' },
    expectedStatus: 200,
    expectValidSchema: true,
  },
  {
    // TODO: once password checking is enforced upstream, expect 400 here instead.
    name: 'login with invalid credentials still succeeds upstream (password not checked)',
    path: ENDPOINTS.user.login,
    queryParams: { username: '{{invalidUsername}}', password: '{{invalidPassword}}' },
    expectedStatus: 200,
    expectValidSchema: true,
  },
  {
    // Known spec gap, verified by hand: this operation declares no response content at all, but
    // the live server returns a body ("User logged out") anyway.
    name: 'logout always succeeds with an undocumented body (known spec gap)',
    path: ENDPOINTS.user.logout,
    expectedStatus: 200,
    expectValidSchema: false,
  },
  {
    // Known live-demo issue, verified by hand: same class of issue as /store - the demo 500s here
    // instead of the documented 404.
    name: 'unknown username 500s upstream with an undocumented body (known live-demo issue)',
    path: ENDPOINTS.user.byUsername,
    pathParams: { username: 'definitely-not-a-real-user-xyz' },
    expectedStatus: 500,
    expectValidSchema: false,
  },
];

export const userPostScenarios: Scenario[] = [
  {
    // Known live-demo issue, verified by hand: user creation currently 500s on the public demo.
    name: 'create user 500s upstream with an undocumented body (known live-demo issue)',
    path: ENDPOINTS.user.base,
    body: {
      id: 900001,
      username: 'qa_contract_user',
      firstName: 'QA',
      lastName: 'Tester',
      email: 'qa@example.test',
      password: 'pw',
      phone: '555',
      userStatus: 0,
    },
    expectedStatus: 500,
    expectValidSchema: false,
  },
];
