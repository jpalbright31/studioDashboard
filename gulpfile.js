var gulp = require('gulp');
var git = require('gulp-git');
var express = require('express');
var browserSync = require('browser-sync');
var runSequence = require('run-sequence');
var tslint = require('gulp-tslint');
var typedoc = require("gulp-typedoc");
var superstatic = require('superstatic');
var shell = require("gulp-shell");
var Rsync = require('rsync');
var opn = require('opn');
var typescript = require('gulp-typescript');
var tsProject = typescript.createProject('tsconfig.json');
var sourcemaps = require('gulp-sourcemaps');
var rimraf = require("gulp-rimraf");
var replace = require("gulp-replace");
var insert = require("gulp-insert");
var concat = require("gulp-concat");
var uglify = require("gulp-uglify");
var tslintStylish = require('gulp-tslint-stylish');
var util = require('gulp-util');

//var commentSwap = require('gulp-comment-swap');
//var tsc = require('gulp-typescript');

// current version jspm@0.16.32
// jspm bundle src/App.js ./dist/index.js --skip-source-maps
// jspm bundle App.ts dev-bundle.js --watch
// https://github.com/jspm/jspm.io/pull/43/files?short_path=4cea63c#diff-4cea63c9d39d3e90a68b25b0030e90aa


/** Typescript configuration **/
var paths = {
    dist: "./dist",
    assets: "./dist/public/assets",
    sources: "./src/**/*.ts",
    sourcesToCopy: ["index.html"],
    targetHTML: "./src/public/index.html",
    bundleHTML: "./dist/public",
    targetJS: "index.js",
    targetMinifiedJS: "index.min.js"
};

/**********************
 * public commands
 *********************/


gulp.task("production", function (callback) {
    runSequence(
        "x_clean",
        "x_assets",
        "x_copy_files",
        "x_build-ts",
        "x_copy",
        "x_bundle",
        "x_minify",
        "x_target",
        "x_rsync",
        //'x_open_server_bundle',
        "x_rsync",
        function (error) {
            if (error) {
                console.log(error.message);
            } else {
                console.log("FINISHED SUCCESSFULLY");
            }
            callback(error);
        });
});

/** launch the systemjs development server, files are kept raw
 * run it from the command line via:
 *
 * gulp development (will launch browser)
 * gulp development --restart (will not launch browser and restart daemon every 10min for best performance)
 *
 **/

gulp.task('development', function (done) {
    console.log(util.env.restart)
    if (util.env.restart) {
        runSequence('x_open_server_development_auto', done);
    } else {
        runSequence('x_open_server_development', done);
    }
});

gulp.task('typedocs', function (done) {
    runSequence('x_typedocs', 'x_docs_rsync', 'x_docs_chown1', 'x_docs_chown2', done);
});

/** upload files to remote server for distribution **/
gulp.task('x_rsync', function () {
    var rsync = Rsync.build({
        source: '/cygdrive/c/msweb/studioDashboard/dist/',
        destination: 'Sean@digitalsignage.com:/var/www/sites/dynasite/htdocs/_msportal/_js/_node/public/',
        exclude: ['*.bat', '*.iml', '.gitignore', '.git', '.idea/']
    });
    rsync.set('progress');
    rsync.flags('avzp');
    console.log('running the command ' + rsync.command());
    rsync.output(
        function (data) {
            console.log('sync: ' + data);
        }, function (data) {
            console.log('sync: ' + data);
        }
    );
    rsync.execute(function (error, stdout, stderr) {
        console.log('completed ' + error + ' ' + stdout + ' ' + stderr)
    });
});

/** upload files to remote server for distribution **/
gulp.task('x_docs_rsync', function () {
    var rsync = Rsync.build({
        source: '/cygdrive/c/msweb/studioDashboard/docs',
        destination: 'Sean@digitalsignage.com:/var/www/sites/mediasignage.com/htdocs/dashDocs'
    });
    rsync.set('progress');
    rsync.flags('avzp');
    console.log('running the command ' + rsync.command());
    rsync.output(
        function (data) {
            console.log('sync: ' + data);
        }, function (data) {
            console.log('sync: ' + data);
        }
    );
    rsync.execute(function (error, stdout, stderr) {
        console.log('completed ' + error + ' ' + stdout + ' ' + stderr)
    });
});

/** Dangerous, this will wipe your current source and sync with GitHub **/
gulp.task('vanish***', function (done) {
    var c = 8;
    console.log('Starting in ' + c + '  seconds');
    var handler = setInterval(function () {
        c--;
        console.log('syncing in ---> ' + c);
        if (c == 0) {
            clearInterval(handler);
            console.log('sync');
            runSequence('x_gitReset', 'x_gitPull', done);
        }
    }, 1000)
});

/**********************
 * private commands x_...
 *********************/

/**  Generate project documentation **/
gulp.task("x_typedocs", function () {
    return gulp
        .src(["./src/*.ts"])
        .pipe(typedoc({
            module: "system",
            target: "es5",
            theme: "default",
            experimentalDecorators: true,
            ignoreCompilerErrors: true,
            includeDeclarations: false,
            out: "docs",
            name: "studioDashboard",
            version: true
        }))
});

/** Transpile TypeScript files **/
gulp.task('x_build-ts', function () {
    return gulp.src('./src/**/*.ts')
        .pipe(sourcemaps.init())
        .pipe(typescript(tsProject))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./src'));
});

/** bundle the app with jspm **/
// jspm bundle-sfx src/App.js ./dist/index.js --skip-source-maps
// jspm bundle src/App.js ./dist/index.js --skip-source-maps
gulp.task("x_bundle",
    shell.task(["jspm bundle-sfx src/App.js " + paths.dist + "/" + paths.targetJS + ' --skip-source-maps'])
);

gulp.task("x_docs_chown1",
    shell.task(["ssh root@digitalsignage.com chown -R Sean /var/www/sites/mediasignage.com/htdocs/dashDocs/*"])
);

gulp.task("x_docs_chown2",
    shell.task(["ssh root@digitalsignage.com chmod -R 777 /var/www/sites/mediasignage.com/htdocs/dashDocs/*"])
);


/** execute a hard reset on git head to latest **/
gulp.task('x_gitReset', function () {
    git.exec({args: '-c core.quotepath=false reset --hard HEAD --'}, function (err, stdout) {
        if (err) throw err;
    });
});

/** execute a git pull **/
gulp.task('x_gitPull', function () {
    git.exec({args: '-c core.quotepath=false pull --progress --no-stat -v --progress origin master'}, function (err, stdout) {
        if (err) throw err;
    });
});

/** launch the systemjs server to view the bundled final output  **/
gulp.task('x_open_server_bundle', function () {
    server = express();
    server.use(express.static('./'));
    server.listen(8003);
    browserSync({
        open: false,
        port: 8080,
        proxy: 'localhost:8003',
        reloadDelay: '5000'
    });
    opn('https://secure.digitalsignage.com/_studiodash-dist/index.html');
});

// , '**/*.ts','**/*.html','**/*.css'
gulp.task('x_open_server_development', ['x_watch_source'], function () {
    process.stdout.write('Starting browserSync and superstatic...\n');
    browserSync({
        port: 8080,
        open: false,
        files: ['index.html'],
        notify: true,
        reloadDebounce: 400,
        server: {
            baseDir: './',
            directory: true
        }
    });
    opn('http://localhost:8080/src/public/index.html')
});

/**
 * to get a fresh server every x minutes for better dev performance run:
 * forever stop 0 ; forever start -a -l f.log node_modules/gulp/bin/gulp.js development_auto ; tail -f ~/.forever/f.log
 **/
//files: ['index.html', '**/*.ts','**/*.html','**/*.css'],
gulp.task('x_open_server_development_auto', ['x_watch_source'], function () {
    process.stdout.write('Starting browserSync and superstatic...\n');
    browserSync({
        port: 8080,
        open: false,
        files: ['index.html', '**/*.ts'],
        notify: true,
        reloadDebounce: 400,
        server: {
            baseDir: './',
            directory: true
        }
    });
    // exit every 20 minutes so forever will restart it
    setTimeout(function () {
        process.exit()
    }, 3200000);
});

gulp.task('x_assets', function () {
    return gulp.src([
        './src/public/assets/**/*'
    ]).pipe(gulp.dest(paths.assets));
});

gulp.task('x_copy_files', function () {
    gulp.src(['./src/**/*.html', './src/**/*.woff2', './src/**/*.css'
    ]).pipe(gulp.dest(paths.dist));

    gulp.src(['./src/public/world_data.js']).pipe(gulp.dest(paths.bundleHTML));

    return gulp.src(['./**/*.html', './**/*.woff2', './**/*.css'
    ]).pipe(gulp.dest(paths.dist));
});

gulp.task("x_lint", function () {
    return gulp.src(paths.sources)
        .pipe(tslint())
        .pipe(tslint.report(tslintStylish, {
            emitError: true,
            sort: true,
            bell: true
        }));
});

gulp.task('x_watch_source', function () {
    gulp.watch([paths.sources]);
});

// Delete the dist directory
gulp.task("x_clean", function () {
    return gulp.src(paths.dist, {read: false}).pipe(rimraf({force: true}));
});

// copy required sources to the dist folder
gulp.task("x_copy", function () {
    gulp.src(paths.sourcesToCopy).pipe(gulp.dest(paths.dist));
});

gulp.task("x_minify", function () {
    gulp.src(paths.targetJS, {cwd: paths.dist})
        .pipe(uglify({mangle: false}))
        .pipe(concat("index.min.js"))
        .pipe(gulp.dest(paths.bundleHTML));
});

// update index.html to point to the minified bundle
gulp.task("x_target", function () {
    gulp.src([paths.targetHTML])
        // remove script tags
        .pipe(replace(/\.\.\/\.\.\/config.js/g, "index.min.js"))
        .pipe(replace(/<!-- sys_import_start -->[^]+<!-- sys_import_end -->/, ""))
        .pipe(replace(/<!-- sys_jspm_start -->[^]+<!-- sys_jspm_end -->/, ""))
        //.pipe(replace(/<script.*\n.*\n<\/script>/g, ""))
        //.pipe(replace(/\n\n/g, "\n"))
        //.pipe(insert.append("\n<script src='" + paths.targetMinifiedJS + "'></script>"))
        .pipe(gulp.dest(paths.bundleHTML))
});



