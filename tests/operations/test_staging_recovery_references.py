"""Synthetic reference fixtures only; no operator, PostgreSQL or Storage calls."""
import importlib.util
import pathlib
import unittest

PATH = pathlib.Path(__file__).resolve().parents[2] / 'scripts/staging-recovery/reference_preflight.py'
SPEC = importlib.util.spec_from_file_location('reference_preflight', PATH)
REF = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REF)


def row(**overrides):
    return dict({'kind': 'document', 'id': 'fixture-id', 'provider': 'supabase',
        'bucket': 'passvero-staging-documents', 'key': 'documents/fixture.pdf',
        'bytes': '3', 'sha256': 'a'*64, 'state': 'AVAILABLE',
        'acceptance_marker': None, 'archived': False, 'same_actor': False,
        'links': 1, 'audits': 1, 'scan_state': 'CLEAN', 'policy': 2}, **overrides)


def stored(ref):
    return {'bucket': ref['bucket'], 'key': ref['key'], 'size': int(ref['bytes']),
            'sha256': ref['sha256']}


def deleted(**overrides):
    ref = row(state='ARCHIVED', acceptance_marker='acceptance:'+REF.FIRST_RUN,
              archived=True, same_actor=True, links=0)
    ref.update(overrides)
    return ref


class ReferenceTests(unittest.TestCase):
    def test_available_bytes_and_prior_accepted_cleanup_are_separate(self):
        active = row()
        first = [deleted(id=str(i), key='documents/deleted'+str(i)) for i in range(3)]
        second = deleted(id=REF.SECOND_DOCUMENT, key='documents/second',
            acceptance_marker='acceptance:'+REF.SECOND_RUN, bytes='750', sha256=REF.SECOND_SHA)
        result = REF.reconcile([stored(active)], [active, *first, second])
        self.assertEqual(result['matchedReferences'], 1)
        self.assertEqual(len(result['acceptedCleanupTombstones']), 4)
        self.assertEqual(result['unreferencedStoredObjects'], 0)

    def test_missing_available_or_image_bytes_are_blocking(self):
        for ref in (row(), row(kind='image', bucket='passvero-staging-images', state='READY')):
            with self.assertRaisesRegex(RuntimeError, 'MISSING_RETAINED_ASSET'):
                REF.reconcile([], [ref])

    def test_archived_history_without_known_cleanup_is_not_ignored(self):
        with self.assertRaisesRegex(RuntimeError, 'MISSING_UNEXPLAINED_ARCHIVED_ASSET'):
            REF.reconcile([], [deleted(acceptance_marker='acceptance:unknown')])

    def test_cleanup_requires_zero_links_same_actor_archive_and_audit(self):
        for override in ({'links': 1}, {'same_actor': False}, {'archived': False},
                         {'audits': 0}, {'scan_state': 'PENDING'}):
            ref = deleted();ref.update(override)
            with self.subTest(override=override), self.assertRaisesRegex(RuntimeError, 'MISSING_RETAINED_ASSET'):
                REF.reconcile([], [ref])

    def test_second_cleanup_requires_exact_id_digest_size_and_policy(self):
        ref = deleted(id=REF.SECOND_DOCUMENT, acceptance_marker='acceptance:'+REF.SECOND_RUN,
                      bytes='750', sha256=REF.SECOND_SHA)
        for override in ({'id':'another'}, {'sha256':'b'*64}, {'bytes':'751'}, {'policy':1}):
            bad = dict(ref, **override)
            with self.subTest(override=override), self.assertRaisesRegex(RuntimeError, 'ACCEPTED_CLEANUP_IDENTITY_CONFLICT'):
                REF.reconcile([], [bad])

    def test_existing_archived_bytes_and_orphans_are_kept(self):
        ref = row(state='ARCHIVED')
        objects = [stored(ref), {'bucket':ref['bucket'], 'key':'history/original.pdf',
                               'size':2, 'sha256':'b'*64}]
        result = REF.reconcile(objects, [ref])
        self.assertEqual(result['matchedReferences'], 1)
        self.assertEqual(result['acceptedCleanupTombstones'], [])
        self.assertEqual(result['unreferencedStoredObjects'], 1)

    def test_size_or_digest_mismatch_blocks_capture(self):
        ref = row()
        for override in ({'size':4}, {'sha256':'b'*64}):
            with self.assertRaisesRegex(RuntimeError, 'DB_PREPARED_BYTES_MISMATCH'):
                REF.reconcile([dict(stored(ref), **override)], [ref])

    def test_duplicate_references_and_extra_cleanup_entries_block(self):
        ref = row()
        with self.assertRaisesRegex(RuntimeError, 'DUPLICATE_DB_REFERENCE'):
            REF.reconcile([stored(ref)], [ref, ref])
        with self.assertRaisesRegex(RuntimeError, 'ACCEPTED_CLEANUP_COUNT_CONFLICT'):
            REF.reconcile([], [deleted(id=str(i),key=str(i)) for i in range(4)])


if __name__ == '__main__':
    unittest.main()
