import jenkins.security.csp.impl.CspConfiguration

// DirectoryBrowserSupport CSP (workspace/artifact file serving)
System.setProperty(
    "hudson.model.DirectoryBrowserSupport.CSP",
    "sandbox; default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self';"
)

// Jenkins UI CSP enforcement (CspFilter)
def cspConfig = Jenkins.getInstance().getExtensionList(CspConfiguration.class)[0]
if (!cspConfig.enforce) {
    cspConfig.enforce = true
    cspConfig.save()
}

println "[CSP] DirectoryBrowserSupport.CSP = " + System.getProperty("hudson.model.DirectoryBrowserSupport.CSP")
println "[CSP] UI enforcement = " + cspConfig.enforce
