# VPS TERMINAL / PENDING_OPERATOR_COMMAND
# Run once as darko in the interactive SSH terminal. No sudo, pipes or redirection.
/usr/bin/python3 -I -B - <<'PASSVERO_SINGLE_TTY_DIAGNOSTIC'
import datetime
import json
import os
import pathlib
import pwd
import stat
import sys

result = {
    'diagnostic': 'AUTH_GATE_SINGLE_TTY_OPEN_RPLUS',
    'relatedAttempt': 'recovery-20261019-reboot-01',
    'observedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'pythonVersion': sys.version,
    'euid': os.geteuid(),
    'isatty': {name: getattr(sys, name).isatty()
               for name in ('stdin', 'stdout', 'stderr')},
    'historicalInvocation': 'sudo /usr/bin/python3 -I -B - with heredoc',
    'diagnosticInvocation': '/usr/bin/python3 -I -B - with heredoc; no sudo',
    'historicalActualStdioAndTTYSession': 'NOT_RECORDED',
    'historicalFailingLine': 'NOT_RECORDED',
    'operation': "open('/dev/tty', 'r+')",
    'openAttempts': 0,
    'automaticRetry': False,
    'AUTH_CALLS': 0,
    'SCANNER_CALLS': 0,
    'SERVICE_CHANGES': 'NO',
    'REBOOT_REPEATED': 'NO',
    'BACKUP_ACCEPTANCE_REPEATED': 'NO',
}
if result['euid'] == 0:
    result.update(result='CONTEXT_REJECTED', reason='NONPRIVILEGED_ACCOUNT_REQUIRED',
                  evidenceSaved=False)
    print(json.dumps(result, indent=2))
    raise SystemExit(1)

account = pwd.getpwuid(result['euid'])
directory = pathlib.Path(account.pw_dir) / '.passvero-auth-gate-diagnostics'
try:
    directory.mkdir(mode=0o700)
except FileExistsError:
    pass
info = directory.lstat()
if (not stat.S_ISDIR(info.st_mode) or directory.is_symlink()
        or info.st_uid != result['euid'] or stat.S_IMODE(info.st_mode) != 0o700):
    result.update(result='CONTEXT_REJECTED', reason='PRIVATE_EVIDENCE_DIRECTORY_REQUIRED',
                  evidenceSaved=False)
    print(json.dumps(result, indent=2))
    raise SystemExit(1)

path = directory / 'recovery-20261019-reboot-01-single-tty.json'
try:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
except FileExistsError:
    result.update(result='STOP', reason='EVIDENCE_EXISTS_NO_RETRY',
                  evidenceFile=str(path), evidenceSaved=False)
    print(json.dumps(result, indent=2))
    raise SystemExit(1)

with os.fdopen(fd, 'w', encoding='utf-8') as evidence:
    result['evidenceFile'] = str(path)
    result['evidenceSaved'] = True
    reasons = []
    if account.pw_name != 'darko':
        reasons.append('EXPECTED_NONPRIVILEGED_DARKO_ACCOUNT')
    if os.uname().nodename != 'srv1834647':
        reasons.append('EXPECTED_VPS_HOST')
    if (result['isatty']['stdin'] or not result['isatty']['stdout']
            or not result['isatty']['stderr']):
        reasons.append('EXPECTED_HEREDOC_STDIN_AND_TERMINAL_STDOUT_STDERR')
    if reasons:
        result.update(result='CONTEXT_REJECTED', reasons=reasons)
    else:
        result['openAttempts'] = 1
        try:
            handle = open('/dev/tty', 'r+')
        except Exception as error:
            result.update(result='OPEN_EXCEPTION', exceptionClass=type(error).__name__,
                          exceptionModule=type(error).__module__, exceptionMessage=str(error))
        else:
            try:
                handle.close()
            except Exception as error:
                result.update(result='OPEN_OK_CLOSE_EXCEPTION',
                              closeExceptionClass=type(error).__name__,
                              closeExceptionMessage=str(error))
            else:
                result['result'] = 'OPEN_OK'
    result['instruction'] = 'RETURN_THIS_ONE_RESULT_AND_STOP_NO_RETRY'
    evidence.write(json.dumps(result, indent=2) + '\n')
    evidence.flush()
    os.fsync(evidence.fileno())
print(json.dumps(result, indent=2))
PASSVERO_SINGLE_TTY_DIAGNOSTIC
