# PENDING_OPERATOR_COMMAND — VPS TERMINAL: install exact continuation, ONE existing-cluster B
sudo /usr/bin/python3 -I -B - <<'PASSVERO_RESUME_B_ONCE'
import base64,gzip,hashlib,json,os,pathlib,stat,subprocess
root=pathlib.Path('/var/lib/passvero-staging-recovery')
code=pathlib.Path('/usr/local/libexec/passvero-staging-backup')
state=root/'recurring';set_id='20261012T043000Z'
target=root/'restore'/set_id
expected='e87d47efed9c8f6775e1bd4b0e3eeb6ad5ed88482d3c4841c41875288e0906e2'
payload='H4sIAAAAAAAC/6U7a3PiSJLf/St03oiT2AFZ4iXwnj9gLPcQi4EF3D29ng5FSSrZmhYSIwm7vXP93y+zHnqA3N03w8S0haoqKzMr35Wcn58vY6rQL/so9MI8elXIfp8mz9RXvCTOw/hA8jCJlSRQ8iecF2bw8lHpGt2haZhdZZ+GzySnSkqzPEmpfna2SBQ/eYmjhPhtJYzD3Hfbyv7RETPaikf2+YE9JIc4pymupbmS4ENESUaVfRgr3hOJH2mmny3T8DGMSaQ80WhP0+wCEAvCR5i8IzAP5saALYl95RDzRb6uLJ9pmoY+zRSSArw08WiWdaLEI5F+dn5+fhbu9kmaK08ke4pCV37lf+CFfsjDSL79LUti+Zxk8mlP8urSlMqnLPE+07z4lpPy+eAKVIo3r9nZ2cbeOrMb5UpRJVu3Rr9nGMa/1bPNYrLa/Lzc4qjbHbldb0xd3+12qWuYQUCG7iggrt+1jP6wZ3led+wOBmNz6BkjMhx1R75rGeZ42LV6w5F6djdZzG7tDYPW9ay+641cwx8MLNPoW10yDgaDPiWB1SOeYdBeMB6Y3jjoW2NvOBj7vVEA4Lu0NzCHgameTaZTe7WdLKa2s5otEGZAAGtqDANraBEjAIyI0eu5/sAKTHNgWr2xBdhb5sAnZDQI/KEVDHx3YAbdEQl8zwKYN5PV1l5LgGafdHuDkWWM3cAaB5QOAx/AdM3ApENA3LQMqw87jkeBO/QC0xoMA9cnfa9nmb2+CSRPl4vb2TsJrzcek+EYII7MoWX1Lc8fDAEPWDimXuB1fW9Aht7QBzjE6o9Hrg/MCMa9gI6BAcOuemb/MplundVktt4AwD/OFPho6sTDU13T3w8g5RN/F8aLJA+D0GPqo7aV78xwUEyo2rpUNAYRPyoctTECfGi/Px4PRu6oS8fjbmB4BPChFrX8rtvzBr4/7nl0aPZ8ZIA/7vr97sgbjny1XcLyxyPD6xtjanV7luUCRMMKupQM+4O+b46NfkAGdOxbXtAdjHxYPgx6o97IN2BCQN2+2moLUpfpI4nD/zC01xTo8Glqx2kSRTsa50jqt2c4CVNox3ui3ucjikGsfHfsD/whHFF3BBha3qjv90E2eoM+SLHlw9mMDZOafVCRsTcYuh4IhNEzekG3Z1QpHlmmP6bDvmcGZEwGxDRIAMT1ez0QaWtoAle7IKkAowtkm0MCMjQaDAZD3wAp8bolxZKGKdntSfjIjjMV7xxPvHTcg/9I8yOCiEkGAw+47ft0aBnG0B91x93xsAfnOYIT6PXJqO91Tdo1hz0XhBqUxuzCoVNzRPqDXpUgF86oFwy745E5AK23PBe02vcIzDdJn45GNHCtMWgb/D/sBf3+aAg6B1x0B/44cAdI0Nez6c/29J/C3MyXkxvUjIV94/xsz1f2eqOerZfM2gjzpq/gr6ZePJP0Ar5e7EmWgW1NOiCwcIqPnZR64C7SV7UFqnZjn648ZLASDS+up1+odwrDJd7nwx4gnJ35NABT+hzSF+o7wNg0055CdBygKFHrknED/MUhymEnP/Ty6nBlVD/sfdAoraKuchicTyxmFRv+fghTqj2T6AB+KQUnlMRiszBQ4iRX2NBlcRgpCcFPrcF/hTtqp2mSamKVACn8oobMaCuH0L8y2oAvcAuQfb26JVFG5Q5xkAi26RHaAU1iyrHS8J2+cWabm9law9l6lju7xKctxK4AqlCAqRST1/a7+uRWgT1+0GHKYUBPubpCLNlrpLe6UvlvxUgMywKxX61n7ydbsPeT7c8gRPZiO9t+VGucxZWSCcw3Cx74IbjzXNBcZU+dWuGR9eyJdAdDNkEH1vqO+5rTTGu19Cf6hcPSWog1fwbcuASjPDvTnyeLd/ZNIVEYjGiF9PCNkkwHfaVANIdjMNrh7SEmO6q19BhIx0ccVLP02Rz1+sO+hdr/frU5pl7QynTgAu2Dd4AIJH7U96+wouLWGqfzmEbHSANmlz5LTAYmgIScwHYIOJV9TmKP4jZVwJzndQ/NgWV76gGweqij41snSJOdE4QRdVBh0XxrKt8ClLFpV8C1PEEQlUNET0Hz9xw4bqPhPyUuOh4OTXU0DQ6fq/E/NbHir8R5xokjJMgRAZUmwktxyAFEk+BrQCkwRKwbJFyhtvQQQk/QHSkWQtfZIh2PXQ8zEK0wr07AD4zXXzBtSh8zoFzje+KB7vwojMGj14QX2BwBRFf91VBbJ0CkZGZ5KsnRbybbSUunsQfCCHLKVZNtV9HG6fx+g9I1ma/tyc1HZ32/WMwW7462oF/w2BTtFg4YYo9biL59ZrrayoozcZ4kYIfZu9YpjWi2Bf8hsgbLl78ecb20rQz37PdIO9/Yc3u6ZTE0uMgw8p3E/Q0MlqaCfSZqG4UKowJIATCz4K+dwqiB0zo/wUR8ztXc2zdAiMAj0Nghvg+YZDQDGCpKZMNU9rrVOm+/tQdi40JOcgVTs/wxRWiCCQfIbZzHA0l9jbRFdiIYwc2GotY8He0UKtRB97OjHVX5SRHR/0+Kqmc0fQ5BqwQz95COXSlET3Uv2e3AOmkP3J26YXzhHjIvj9AYgedjf5P0UQ9SSiHr+Zwnex1yi5zufLMaQ1zApIvKpIty0tsA9DsSA/opznlH83ugGx8z+AcJ/dTSfcrlEzxGGu6P/BdIQnCA2I/k3pOWqoly/iYWF8jTi4dJ59+k8x+jM3Y+/XSutjkrWhWBv1/MtscGmHnoTEYFqHxC29QrAGG2mE3A10yBmpnK8RB8zZ6SF0FihYOdDtgPOOn89Wr7uqftf4ZRdAfEs4cNBIIkaq9BAUiat20waRugbwWio9bYhIghLmAT0OoAiogVvuHEQI4MlHCZelBFxqx+qvGVE/ygIhrqJ+al0IaqzI/JQYGKGI8T9SQIkDMlIWIqpv8Qsnce0wRCs5OZnFIxd3wKFVDW/UPKkxvJMY0d5EPvsmN+AgaL8OmOfLnfAN7MC48N8flTELcALjnkyPMSZG/wBkQVzOjzw6er4vj3r/lTEveUzkzpXCuonGiKa+7D4f7RQbueJdEznGYLdVfpdLwoyah6YkjgXCXj6vIA+M4WN/bKXqAgO2t7c3+Htny5uV/b8PVf97N1JYbhJgNNDQ8WpMnJhM15jBKXRIqM77mocPvBnquBv/3LbLMFD+Gg8ZksbpzJdmvfrbbC8iQvbF1GIzDCEEwcb1hX7+TlQQWDOvO5NAh7hgzmQzHZgyqV46KicXIcbDZoZBiAzG5Y+MdXFFWLYtaevGLUcI1elc8x+6bVM/vtI9rKQFCkBuiYOFP4s4NyTr/kSMYRgaA3ECDCZOnPtpP1O3tbi1/5nGpkv00P9IhBLASAP5st2C4ewDGAHZKDtdnnPOxjsvqH4OSlYCPQQw55ArYz9NYUYgsYYbnDV8yz17N3s8VkLk/vhFq+P8YMR7uj76lvrrPSHpojmQEI2nAFzN8RCIuOpqIKc6G9vr8BzjjLha1+j/YyeOwEkN3lnYCEERi3KhNKa8vTNCBa3WyXK7TKe0gQKL54b69ntx+dhf3B2YBs302cDzNISnjICwktz/xQi95P5jaEwJuqI+TZGsK5X6zt9zP7AyyBuHuzXU9moI03s9tbe43L1B87g9vJbI56Wz8DtAkHJnGCEyVTxZCgu8a1YhUKhBcdwCmlkgcrgI1sIBjIrGi6C7MMLGKG49I9GpZRLYUcfSA+eqYbnnqvyCGjviQIKU3zMCBengGlBNwRjqFI12iVNqpOa1M8lBXurK0kQZBB0A0pAxhtwpgiJlU8XLt8J+bX3omlwhM2mrT5cgoo3iw/LFh5o4gSeMKRHFIPdy7PQRarVfgCgsrKHyjzNM/wFddDNPcRCMAzdfIEcghBskBRLyq4/IGNOZgbvfIyOM9RYVwugKAwDF4xDtU4SqwsXpcCuejIAAqg+L7BFraxqlNlAIh1kyGsqecpMzDISYJvG6aKYb8srHpFxSAsvRHgqEAPZPRusp3+7EiKuChXCLgsmXbsCy4FG1EUi+NdwXndHlG3A9EtNU4cORInYvkLCbhJ9071FFZFyWOHw6mwBLd5kMOM85vJe2T38n4NCfcUMrf58t0Rbo0iK/O329nc3jB/vJqA7dluREovMg9Y4zg8uXYcyF1efDDGgOX+BWJUrZqgyBSYFQ4gAKmlk+3CoW2W03/a20qqd1q1kkD1/QuWib7t6WrbIO9W7xww05vZciETYeZrizyBRY/mUK1WlipLGPC/Kba8dcL8iKYKWOMnzD95iUKEQyIyVHZgLRUXr6rAikEChddWzNFIqtVMwRAu0894UrxnMQ7W8tX9o8MyWx1BorDK4qaD0SbJ8YoqAdcomfJrfDqhOKxyUoMpxq2eXFJsxAqkCmhMZT0FUndkf3Wyx69xOR3/Tykm1LDP1+LgWdLCrvCAHJQASSeWPXaZ1nDmR2fHITSIQFlUeOvYcWntuPGYBS6Vk57cg7vmpa779WQLJ36kKxl5ZgdzopLc+XWIFzVpMFv2UKjDfSgCzxNRVlfLzfYdhDDO/eymOVQswkS+ZVYA519R6xvZ840CFRt/CUEx+UWhzv9g5JXhTaVbLTMLkthrFJYYDtGhXzRNNbuWbsB/mLkPBv1eH/KQ/7pSjKoqLddgqhfO/cZusD5At71+b2PQhqcAhuieHYLIAXSQtF3ofS9wbP8Jz/BDnzdiLlam4BfCa87QNRUhDAtTStuHgo6Sf3xiFcnnZdVafoercHL+BAl7MTPJIBnKvwDlqbCNUj4m07mzmNzZ5Zs8hQ3TjEQOyKd2LB1twC2Kkhcne91Buv85E1cBJ0cuwYHIc0BYZ2VO/wf3KcQAIlq0qJgnTOcNggDnC3JSOKOjoqJaV4dDrD3IL6t3mPmCJRMFkw5GpifFSxyIGgZKidLRf7aqNZYXBo5VmfBSDySKFTHwZQL/nnc85bjId6VCDu4p6ByvmD7gNwhJvzhcv4qSYghzz5Wfit2qeAmHyBP6+vJ9GWpfYXyN4yiiz8Q7HHZXENjhmx354gg1ZTNNA0xEsRXkPtjycCWiWF18r7rutpLzGsZVf9Cgs7ywWwQM9eBWis5JdZYHcKzeetl4QFhHBS/EojGsiMIz46H6taHKfHLtUxfYatU3Txy0EtppkZcGBBI7B4Q4zghjlsMcRhJHr1iQ5aEBvzqXCNxcO4slFkog7lsu5h+bZJlFYGDatss1JnQiBqvzSWBTyewRZ6wviflH2Zic3pTEieBQAPKFP2o3BHfN8WAQxmH21FDVaSusIlF0zcg0AaPOtiRB1ob+IpQfKyBVk7gfzt2+W0mRQblyElA/FAF7Y7qH2b3kKYbMNiTs0+0MPBqaOYExA1VFtrzFKvapTtUbagEbhnj9SlqC43lcp0S0EQA/ahSnZxKhFwKIckORCYqv2klSIc6oOMNTmUclvp5sbMzzUOI2JQNQXrkQQ5woBbnK14fP9JUFR/IVf4H+Ex5Y6qBCDsdr/+wWCljHLh3Ai2HHCj7mWIBuHd9nsWKdOG8JnbmqJjRUGACHW/VvtTUFemJi+y2yT9lTKRBtpsuVrQqRdCOWUR2bAAAKSVjriH1wahpfIoNZ0LIHlb+C8BKJxTkFbbvwkSckmSBLLqkOwEGj/We54wmap5RM5nOHoQeydV9khyWSf2DgfVmjSBWGmPuZv7eU2/XyjlW2kVbuKIKQphqL2VtF7oAnz4n7Wkl1EQivMZyg0oztxv7XPS+9HaF6zPViYiWzzrBXKvZouWMJrvmYJxsMQde2qNwxFQQrDM+y/AObkkfaVBwQQ8e1gX8AOwOaMjzqdkS+FQaEZFgxOhKocpYOmK8/iqpR6lM0rBHZuT5BC52BWwa/S30sQ4PRBt27EqMYkF4qIi51DxiLID/4d5gH4nUsrAy+xhGqY8q4y4cFvUfjDTos4dAY5cGXTVCi7l6AOR1utAcFPzCrjT1IxEtM+MUwO+43ka+gzdeHvMNOqtC3RKBVz2xOvXhhoRFBkd5UrHZTDgW5VVlynqxW89mUp7IYpcjomd97i3SjLDHKfP6C7LH9lhHSQbHssAUcA+l6dZmnl8BOzl0UF0V3TGVi1QDhBjS9xkF5ycIK+Yiuc30/m7OWMMEsBqNUl7f3ZiNgnUtK7ljDhhCT+ubFULnx3fLmHqzJar18by+wYaVAIPYj2sg2VrBVT3iHxk1gwxcXV0l4xe79JutjdZ7iRFT2t5nJZiAtjcCrLFzczO0KDznNjmhbrpaej3GvnHiZf1dXs2ybmSwRyPMv6A55mnIU34t85tupd+mHS99xc42JttDHS+VURb+26q14ZWszzxHLO3VsoxLpn2CizAUrhLU+FX3hDiQ/e8h/MJ2vIy4zo7EBahk/X/2hYhsaJitys0v8B2OSOcTYODDFL4vlDe9Yk9zRQVGR/4iaaDkCqfjaOnVS2EnIu1rw5r5sE0NfL4az3AekWsr/KMPBoDeUrhwvVo/MgZCHyqkD4/DIWQtUdgTwOIArV9XUbA1sFNfwKzB+Rfq+tqegSuuPrAq0UZsMexUiHJ5/8PIqpCr6MtC2f0Fw34fmB29BuoZ4AS8lrj9uRa37zt5OMJj7LtRwBzL4FtziRgBBAvFopb8LMfOe6I58SMPiHrk27B4y7NHIqhNAmhb29wHv8v0UYm6xCKtyx9LALvzn28bKHDMkIlGUvP9eCCVzV2ZuZdLwFqw3XWHtqhfNjayaXwqez0G4Nlt27XrdxZQc+c0uLmD63/+O6WadOTJIvlQqQTTe7pSB8OU3Yud2zUzC1Mq34534cU5i/7p+cJWrUVEa4PUDNJvFQV2yU3r7bvR4L24SV2nyDGF0ui7ZhDWKlb2+Xa7v+F0tdj99oO7kkD9tPBLHOFs0TYvpyFKce7RH9Sc4OBVLtSd1hcWyIGptr+aTj+pXWRZgHSn/v46RqhxWu1OKFsPickreAtd7RkSggA9F3Zj9tkHE05hF7PYRhVgX8p+O+ekHekmAhfLG+a/2dOBlUtmDo4CryhQsOSkkwF8iiT405XMYQSzLf/IER8B+QsR/54SX3IrHmqL0H6r0y0uMgjX1Gsi3rjN+9Aai6cKDwzi9N0fvjH5U9OhxrLAI6+DblB2cDLREC1jlFrxYUwQnx7SIO4Jac0O72tHx19sZVPGzAdE+Vlgm8E2Q6uIF7HbyDttfAe4LGoAU28LSa4hwWEvuJbv7YAXCKtQ/1RVRFOB4E4tGK72zvMUEYyOIOfgA9vrV2iFV7HVkjY5/mG1zaHwVkRKf3uIt/VhfEW90x8H03HGq/bZ/NLTJSD2Gd/KxXel64Q9vd7YIsvAXdvKuEK/UeR+97PZGpQON0Vkb3ZEms2FWPuqIZldWvRdNcmjV7zAqq3S5sZi8bqeE2mQehPysKQbO5monArESmPydxslIedXzpiWs3LsgL3lNVuprBDF13ZT9lrjsrdi01gv+doOerPSCn6nMTzKdoxX4KEZAgDxcRoTjIPcdR1BR24qfy1mlqxul22aPGFaSTGHyUkeOBep1Sa22vjf/IEKT1qConGLvfOYctc5Xb5JPVzS3DcjP35TiN54COyXM8ECYqv1DcRP/Vfxexad7GmPVquisEiv4Dz0ztHLobGrwZTd2xTbRetsZ68GVUsMuDYVYcwWUKxsa1uoM4Bn+Kf3iUrw2WfywiP3ARXbUnTbdM1mEkwENiMXVI3xbOh/WGMEo/8u/TSHM28ov9i/TuXxeLG+X8/nyQ1sxkqFhnP7mgF1Ew9TAZzsEeC3+orK76CeC2dplY+7Ishb/sNuLpKUtZrdZHcv5TF+zhoOWHz5XZ8ZZU39lZTbxLgD38KTBd8Qpe409TQ6EECMmWqXMDOIW51qBicyf8IoVgRztjycKbM41s3X2f2W0GWT2PAAA'
check_id='INSTALL_IDENTITY'
def require(value,reason):
    if not value:raise RuntimeError(reason)
def digest(path):
    info=path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o077,'PRIVATE_FILE')
    return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):
    digest(path)
    return json.loads(path.read_text())
try:
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','VPS_IDENTITY')
    pins={'recurring.py':'14a2358709bf79fee6fd17321f1e6d55170740e098fb6cf1756fbda4c3713418',
          'recurring_acceptance.py':'fa000e06f767a0f637a033bd57f11517397ebd715daa85fd67f5db51f28afdc7',
          'recurring_catalog.py':'b0b84b1a06035c04949777d664ffe73e9362b063357f72ee7205097c1b2513f7',
          'config.json':'399a693588167747cd565fdf179ecfc2dc5a6c6d756a7498bdf73f93fe959d62'}
    for name,pin in pins.items():require(digest(code/name)==pin,'EXISTING_PIN_CHANGED')
    value=read(state/'state.json');row=value['completed'][-1]
    require(value['mode']=='ACCEPTANCE' and value['attempts']==2 and len(value['completed'])==2
            and not value['hold'] and value['attempt']['complete'],'A_REQUIRED')
    require(row['setId']==set_id and row['snapshotId']=='b28b2c9ebdb22eb01ffa6b8fabd2704637cc29b55916c08a6828db7019627368'
            and row['manifestSha256']=='2c74bc8b0d55710472a9f554eaf73ac00e3f951c9f479c659d38f29b2e3516f1','EXISTING_SET_CHANGED')
    require(not (state/'resume-attempt.json').exists(),'RESUME_ALREADY_RESERVED')
    before_state=digest(state/'state.json')
    body=gzip.decompress(base64.b64decode(payload,validate=True))
    require(len(body)<40000 and hashlib.sha256(body).hexdigest()==expected,'CONTINUATION_PAYLOAD_CHANGED')
    helper=code/('recurring-resume-'+expected+'.py')
    require(not helper.exists() and not helper.is_symlink(),'CONTINUATION_ALREADY_INSTALLED')
    # Display concrete review before installing; existing release/helper pins never change.
    print(json.dumps({'review':'EXACT_APPROVED_DELTA','helperSha256':expected,
        'constraintPairs':[{'table': 'AccessRequestAdminNotification', 'constraint': 'AccessRequestAdminNotification_state', 'oldPair': None, 'newPair': ['c9e085a6e449958b82e992f0ca3fee7e7d2b3c5dd93ce613dcf17d92d428c68d', 'd980c409e72377b44907f2ea6454d1904fa5e9d7cf258d8c66f3838d0645feb4']}, {'table': 'OrganizationReminderEnrollment', 'constraint': 'OrganizationReminderEnrollment_origin_check', 'oldPair': None, 'newPair': ['6f1db9d5d6358287f27c84d4fdc3546277d6d7901e140439c56bcd170303f230', '871d9e64c1fa9a5a10aff25433c9f761e44206f9c52d7c16a98f85556d0399c2']}, {'table': 'ReminderCampaign', 'constraint': 'reminder_campaign_budget', 'oldPair': ['91ddd21f16057e49cc79af46397097dc9505477f96682a8a34bb2e24f9b257f4', '2eded7720504308a08c823cff5976e4786de2b4211b777613001336b2583ca44'], 'newPair': ['a1a55c449dde67006d8292963958807f34a84c21e2163bf1e0f61285ae18a453', 'b4fa3f629815b8f7cb273dca1281a4e88efb793bd93b63f4486151287b5d9fb5']}],'existingPinsUnchanged':pins}),flush=True)
    check_id='INSTALL_SEPARATE_CONTINUATION'
    fd=os.open(helper,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as handle:
        handle.write(body);handle.flush();os.fsync(handle.fileno())
    require(digest(helper)==expected,'INSTALLED_CONTINUATION_CHANGED')
    check_id='RUN_ONE_EXISTING_CLUSTER_CONTINUATION'
    args=['/usr/bin/systemd-run','--quiet','--wait','--unit','passvero-stage-recurring-resume-'+set_id,
        '--property=Type=exec','--property=Restart=no','--property=KillMode=control-group','--property=KillSignal=SIGKILL',
        '--property=RuntimeMaxSec=15min','--property=TimeoutStopSec=35s',
        '--property=StandardOutput=null','--property=StandardError=null',
        '--property=ExecStopPost=/usr/bin/python3 -I -B '+str(helper)+' --close',
        '/usr/bin/python3','-I','-B',str(helper),'--resume']
    result=subprocess.run(args,timeout=950)
    output={'unitReturnCode':result.returncode,'setId':set_id,'automaticRetry':False}
    for name in ('resume-attempt.json','resume-first-failure.json','resume-close-failure.json'):
        path=state/name;output[name]=read(path) if path.is_file() else None
    for name in ('summary.json','resume-closure.json'):
        path=target/name;output[name]=read(path) if path.is_file() else None
    output['stateUnchanged']=digest(state/'state.json')==before_state
    output['pinsUnchanged']=all(digest(code/name)==pin for name,pin in pins.items())
    output['units']=subprocess.run(['/usr/bin/systemctl','show',
        'passvero-staging-backup.timer','passvero-staging-backup-monitor.timer',
        'passvero-subscription-reminders.timer','passvero-subscription-reminders.service',
        '--property=Id,ActiveState,SubState,UnitFileState'],check=True,capture_output=True,text=True).stdout
    summary=output['summary.json'] or {};closure=output['resume-closure.json'] or {}
    output['B']='PASS' if (result.returncode==0 and summary.get('restore')=='PASS_LATEST_NEW_B2_DB_AND_FILES'
        and closure.get('cluster')=='STOPPED' and closure.get('parentPermissions')=='PRIVATE_0700'
        and closure.get('stagingRuntime')=='PASS_EXPECTED_STAGING'
        and closure.get('writerTimerBaseline')=='RESTORED'
        and output['stateUnchanged'] and output['pinsUnchanged']
        and output['resume-first-failure.json'] is None and output['resume-close-failure.json'] is None) else 'STOP'
    print(json.dumps(output,indent=2,sort_keys=True))
except BaseException as error:
    reason=str(error) if __import__('re').fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
    print(json.dumps({'result':'STOP','CHECK_ID':check_id,'reason':reason,'automaticRetry':False,
                     'instruction':'RETURN_OUTPUT_DO_NOT_REPEAT_ORIGINAL_B_OR_CONTINUATION'}))
    raise SystemExit(1)
PASSVERO_RESUME_B_ONCE
