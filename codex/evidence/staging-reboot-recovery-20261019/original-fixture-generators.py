"""Original memory-only fixture generators recovered from the recorded session.
PDF: command at JSONL line2749; PNG: line3013. No file/network/subprocess calls.
Original Python literals are retained for exact byte identity.
"""
import struct
import zlib


def original_pdf():
    stream=b'BT /F1 14 Tf 50 780 Td (SYNTHETIC - STAGING REBOOT RECOVERY 20261013) Tj 0 -30 Td (No business or personal information.) Tj ET\n'
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'endstream']
    output=b'%PDF-1.4\n'; offsets=[0]
    for n,obj in enumerate(objects,1):
     offsets.append(len(output));output+=str(n).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
    xref=len(output);output+=b'xref\n0 6\n0000000000 65535 f \n'+b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])+b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+str(xref).encode()+b'\n%%EOF\n'
    return output


def original_image():
    width,height=512,256
    pixels=b''.join(b'\x00'+b''.join(bytes((32,105,155) if ((x//32+y//32)%2)==0 else (225,238,247)) for x in range(width)) for y in range(height))
    def chunk(kind,body):return struct.pack('!I',len(body))+kind+body+struct.pack('!I',zlib.crc32(kind+body)&0xffffffff)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',width,height,8,2,0,0,0))+chunk(b'tEXt',b'Description\x00SYNTHETIC STAGING REBOOT RECOVERY 20261014 - no business or personal data')+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')
    return png
