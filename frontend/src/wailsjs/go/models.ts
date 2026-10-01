export namespace engine {
	
	export class ArchiveEntry {
	    path: string;
	    name: string;
	    parent: string;
	    folder: boolean;
	    size: number;
	    packedSize: number;
	    modified: string;
	    attributes: string;
	    crc: string;
	    encrypted: boolean;
	    method: string;
	    extension: string;
	
	    static createFrom(source: any = {}) {
	        return new ArchiveEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.parent = source["parent"];
	        this.folder = source["folder"];
	        this.size = source["size"];
	        this.packedSize = source["packedSize"];
	        this.modified = source["modified"];
	        this.attributes = source["attributes"];
	        this.crc = source["crc"];
	        this.encrypted = source["encrypted"];
	        this.method = source["method"];
	        this.extension = source["extension"];
	    }
	}
	export class ArchiveInfo {
	    path: string;
	    fileName: string;
	    type: string;
	    physicalSize: number;
	    headersSize: number;
	    method: string;
	    solid: boolean;
	    blocks: number;
	    totalFiles: number;
	    totalFolders: number;
	    totalUncompressedSize: number;
	    totalPackedSize: number;
	    isEncrypted: boolean;
	    entries: ArchiveEntry[];
	
	    static createFrom(source: any = {}) {
	        return new ArchiveInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.fileName = source["fileName"];
	        this.type = source["type"];
	        this.physicalSize = source["physicalSize"];
	        this.headersSize = source["headersSize"];
	        this.method = source["method"];
	        this.solid = source["solid"];
	        this.blocks = source["blocks"];
	        this.totalFiles = source["totalFiles"];
	        this.totalFolders = source["totalFolders"];
	        this.totalUncompressedSize = source["totalUncompressedSize"];
	        this.totalPackedSize = source["totalPackedSize"];
	        this.isEncrypted = source["isEncrypted"];
	        this.entries = this.convertValues(source["entries"], ArchiveEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CompressOptions {
	    inputPaths: string[];
	    archivePath: string;
	    format: string;
	    level: number;
	    method: string;
	    password: string;
	    encryptHeader: boolean;
	    volumeSize: string;
	    threads: number;
	
	    static createFrom(source: any = {}) {
	        return new CompressOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inputPaths = source["inputPaths"];
	        this.archivePath = source["archivePath"];
	        this.format = source["format"];
	        this.level = source["level"];
	        this.method = source["method"];
	        this.password = source["password"];
	        this.encryptHeader = source["encryptHeader"];
	        this.volumeSize = source["volumeSize"];
	        this.threads = source["threads"];
	    }
	}
	export class ExtractOptions {
	    archivePath: string;
	    outputDir: string;
	    password: string;
	    selectedFiles: string[];
	    overwriteMode: string;
	
	    static createFrom(source: any = {}) {
	        return new ExtractOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.archivePath = source["archivePath"];
	        this.outputDir = source["outputDir"];
	        this.password = source["password"];
	        this.selectedFiles = source["selectedFiles"];
	        this.overwriteMode = source["overwriteMode"];
	    }
	}
	export class TestResult {
	    success: boolean;
	    errors: string[];
	    message: string;
	    duration: string;
	
	    static createFrom(source: any = {}) {
	        return new TestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.errors = source["errors"];
	        this.message = source["message"];
	        this.duration = source["duration"];
	    }
	}

}

