import sys
import dns.resolver


def _get_fmsg_hosts(domain: str) -> list[str]:
    hosts = []
    try:
        answers = dns.resolver.resolve(domain, 'TXT')
        txt = answers.to_text()
        hosts = str.split(txt, ' ')
        print(f'TXT Record: {txt}')
    except dns.resolver.NXDOMAIN:
        print(f'Domain does not exist: {domain}')
    except dns.resolver.NoAnswer:
        print(f'No TXT records found for {domain}')
    return hosts


def get_fmsg_hosts(domain) -> list[str]:

    # first we try the _fmsg subdomain
    subdomain = '_fmsg.' + domain
    hosts = _get_fmsg_hosts(subdomain)

    if len(hosts) > 0:
        return hosts

    # no fmsg hosts found so far, fallback to trying the domain itself
    hosts = _get_fmsg_hosts(domain)

    return hosts


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python fmsglookup.py <domain>")
        exit(1)

    domain = sys.argv[1]
    hosts = get_fmsg_hosts(domain)

    if len(hosts) == 0:
        print(f'\nNo fmsg hosts found for {domain} :(\n')
        exit(1)

    print(f'\n*** fmsg host(s) found! and should be tried in order they appear below ***\n')
    for i, host in enumerate(hosts):
        print(f'{i}.\t{host}')
