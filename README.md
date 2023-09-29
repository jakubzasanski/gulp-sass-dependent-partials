

It proces scss partials files and add the files that import them to the pipe.

![version](https://img.shields.io/github/v/tag/jakubzasanski/gulp-sass-dependent-partials?label=version)
![license](https://img.shields.io/github/license/jakubzasanski/gulp-sass-dependent-partials)


## Install

```
$ npm install --save-dev gulp-sass-dependent-partials
```

## Required

- Node `>=16.0.0`
- NPM

## Usage

```js
import sassDependentFiles from 'gulp-sass-dependent-partials';

gulp.src(currentPaths.development.scss + "**/*.sccs")
    .pipe(plumber({
        errorHandler: errorHandler
    }))
    .pipe(sassDependentFiles(currentPaths.development.scss))
    .pipe(sass())
    .pipe(rename({"suffix": ".min"}))
    .pipe(gulp.dest(currentPaths.production.css))
    .on("end", _ => {
        callback();
    });

```

## Thanks

- [Giorgio Aquino](https://github.com/G100g) for [gulp-sass-partials-imported](https://github.com/G100g/gulp-sass-partials-imported)
- [Michael Mifsud](https://github.com/xzyfer) for [sass-graph](https://github.com/xzyfer/sass-graph)
