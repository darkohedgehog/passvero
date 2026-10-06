import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const sql=readFileSync('prisma/migrations/20261005120000_onboarding_notifications_and_approval/migration.sql','utf8');
test('onboarding migration is additive, disabled by default and constrains delivery attempts',()=>{
 assert.deepEqual([...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map(m=>m[1]),['PlatformOnboardingGrant','OnboardingNotificationSettings','AccessRequestAdminNotification']);
 assert.equal([...sql.matchAll(/FOREIGN KEY/g)].length,2);
 assert.doesNotMatch(sql,/\b(INSERT INTO|UPDATE "|DELETE FROM|DROP TABLE|TRUNCATE|GRANT |CREATE POLICY)\b/);
 assert.match(sql,/"enabled" BOOLEAN NOT NULL DEFAULT false/);
 assert.match(sql,/CHECK \("id" = 1\)/);
 assert.match(sql,/"requestId" UUID NOT NULL/);
 assert.match(sql,/PRIMARY KEY \("requestId"\)/);
 assert.match(sql,/"attempts" BETWEEN 1 AND 3/);
 assert.match(sql,/ON DELETE RESTRICT/g);
 assert.doesNotMatch(sql,/ALTER TABLE "(?:User|Organization|Subscription|AccessRequest)"/);
});
