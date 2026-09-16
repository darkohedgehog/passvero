"""LOCAL MAC: use an existing normal browser login, never send the cookie to chat.
The hidden terminal prompt and encrypted SSH stdin are the only credential path.
Only the bounded-lifetime remote 0600 handoff stores the credential temporarily.
It is never echoed, placed in argv, or included in an exception.
"""
import getpass
import subprocess

transferred = False
cookie = getpass.getpass('Existing staging browser Cookie header (hidden; never paste into chat): ')
try:
    assert 0 < len(cookie.encode()) <= 8192 and not any(c in cookie for c in '\r\n\0')
    subprocess.run(['ssh', '-T', 'passvero', 'python3 -I /opt/passvero-scan-boundary/session-handoff.py'], input=cookie.encode(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, check=True)
    transferred = True
    # sudo reads the operator password from the allocated terminal. The session
    # itself remains in a 0600 bounded-lifetime handoff file, never in argv.
    result = subprocess.run(
        ['ssh', '-t', 'passvero', 'sudo python3 -B /opt/passvero-scan-boundary/read-session.py'],
        timeout=45)
    print('SESSION_OPERATOR_COMMAND_EXIT=' + str(result.returncode))
except Exception:
    print('SESSION_CHANNEL=FAIL')
finally:
    cookie = None
    if transferred: subprocess.run(['ssh', '-T', 'passvero', "python3 -c \"import pathlib; pathlib.Path('/tmp/passvero-staging-session-input').unlink(missing_ok=True)\""], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
