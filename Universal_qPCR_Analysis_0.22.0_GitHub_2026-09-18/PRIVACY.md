# Privacy architecture

This distribution is a static local-first application. qPCR input files are read with browser APIs and are not transmitted to the hosting server. Analysis results, figures and DOCX reports are created in browser memory and are discarded when the tab is closed or reloaded.

The user may explicitly download a `.qpcrproj` file to their own device. A full project contains normalized qPCR measurements, settings, import mappings, result snapshots and may include sample identifiers. Opening a project reads that local file back into browser memory; it is not uploaded. Users remain responsible for storing and sharing project files under the data-protection rules applicable to their study.

The hosting layer serves versioned HTML, JavaScript, configuration and template files only. It has no account system, database, analytics endpoint or upload endpoint. Ordinary infrastructure access logs may still record an IP address, timestamp and requested static path; their retention is controlled by the hosting institution.
