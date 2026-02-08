"""
fmsg DNS Resolver Module

This module provides functionality to resolve fmsg host IP addresses for a given
domain name, as specified in the domain resolution section of the fmsg specification.

According to the spec, the fmsg host domain is `_fmsg.<domain>`. For example,
for the address `@B@example.edu`, the fmsg host is at `_fmsg.example.edu`.
"""

import socket
from typing import List, Optional


def resolve_fmsg_host(domain: str, address_family: Optional[int] = None) -> List[str]:
    """
    Resolve the IP address(es) for an fmsg host given a domain name.

    The fmsg host domain is the subdomain `_fmsg` of the domain name.
    For example, for `example.com`, the fmsg host is at `_fmsg.example.com`.

    Args:
        domain: The domain name (e.g., "example.com"). Should not include the `_fmsg` prefix.
        address_family: The socket address family to resolve. Can be socket.AF_INET
                       for IPv4 only, socket.AF_INET6 for IPv6 only, or None (default)
                       to resolve both IPv4 and IPv6 addresses.

    Returns:
        A list of IP address strings. Empty list if no records found or on error.

    Raises:
        socket.gaierror: If the domain cannot be resolved.

    Examples:
        >>> resolve_fmsg_host("example.com")
        ['93.184.216.34']

        >>> resolve_fmsg_host("example.com", socket.AF_INET6)
        ['2606:2800:220:1:248:1893:25c8:1946']

        >>> resolve_fmsg_host("fmsg.org", socket.AF_INET)
        ['104.21.82.45']
    """
    fmsg_domain = f"_fmsg.{domain}"

    if address_family is None:
        # Resolve both IPv4 and IPv6
        results = socket.getaddrinfo(fmsg_domain, None, 0, 0, socket.IPPROTO_TCP)
    else:
        results = socket.getaddrinfo(fmsg_domain, None, address_family, 0, socket.IPPROTO_TCP)

    ips: List[str] = []
    for family, _, _, _, sockaddr in results:
        ip = sockaddr[0]
        if ip not in ips:
            ips.append(ip)

    return ips


def verify_originating_ip(domain: str, originating_ip: str) -> bool:
    """
    Verify that an originating IP address is in the list of resolved fmsg host IPs.

    This is a security measure specified in the fmsg protocol. Before challenging
    a sender, the receiving host MUST lookup the sender's domain and verify the
    originating IP address of the incoming message is in the resolved IP addresses.
    Otherwise, the connection MUST be terminated before challenging.

    Args:
        domain: The domain name of the sender (without `_fmsg` prefix).
        originating_ip: The IP address the connection originated from.

    Returns:
        True if the originating IP is in the resolved IP list, False otherwise.

    Examples:
        >>> verify_originating_ip("example.com", "93.184.216.34")
        True

        >>> verify_originating_ip("example.com", "1.2.3.4")
        False
    """
    # Determine address family based on originating IP
    if ":" in originating_ip:
        address_family = socket.AF_INET6
    else:
        address_family = socket.AF_INET

    try:
        resolved_ips = resolve_fmsg_host(domain, address_family)
        return originating_ip in resolved_ips
    except socket.gaierror:
        return False


if __name__ == "__main__":
    # Test resolving fmsg host for fmsg.io
    print("Resolving fmsg host for fmsg.io...")
    domain = "fmsg.io"
    try:
        ips = resolve_fmsg_host(domain)
    except socket.gaierror as e:
        print(f"DNS resolution failed for _fmsg.{domain}: {e}")
        print("\nNote: The _fmsg.fmsg.io domain may not exist. This is expected")
        print("for domains that haven't set up fmsg hosting.")
    else:
        if not ips:
            print(f"No IP addresses found for _fmsg.{domain}")
        else:
            print(f"Resolved IP addresses for _fmsg.{domain}:")
            for ip in ips:
                print(f"  - {ip}")

            if ips:
                # Verify the first IP address, obviusly in a real scenario you would verify the actual originating IP of an incoming connection
                test_ip = ips[0]
                print(f"\nVerifying originating IP {test_ip}...")
                is_valid = verify_originating_ip(domain, test_ip)
                if is_valid:
                    print(f"  ✓ {test_ip} is a valid fmsg host IP for {domain}")
                else:
                    print(f"  ✗ {test_ip} is NOT a valid fmsg host IP for {domain}")
