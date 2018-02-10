//dependencies
var express = require('express');
var router = express.Router();
var path = require('path');

var axios = require("axios");

//require request and cheerio to scrape
var request = require('request');
var cheerio = require('cheerio');

//Require models
var Comment = require('../models/Comment.js');
var Article = require('../models/Article.js');

//index
router.get('/', function(req, res) {
    res.redirect('/articles');
});

// A GET request to scrape the Verge website
router.get('/scrape', function(req, res) {
    // First, we grab the body of the html with request
    request('https://www.nytimes.com/?WT.z_jog=1&hF=f&vS=undefined', function(error, response, html) {
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        var $ = cheerio.load(html);
        var titlesArray = [];
        // Now, we grab every article
        $("article h2").each(function(i, element) {
            // Save an empty result object
            var result = {};

            // Add the text and href of every link, and save them as properties of the result object
            result.title = $(this).children('a').text();
            result.link = $(this).children('a').attr('href');

            //ensures that no empty title or links are sent to mongodb
            if(result.title !== "" && result.link !== ""){
              //check for duplicates
              if(titlesArray.indexOf(result.title) == -1){

                // push the saved title to the array 
                titlesArray.push(result.title);

                // only add the article if is not already there
                Article.count({ title: result.title}, function (err, test){
                    //if the test is 0, the entry is unique and good to save
                  if(test == 0){

                    //using Article model, create new object
                    var entry = new Article (result);

                    //save entry to mongodb
                    entry.save(function(err, doc) {
                      if (err) {
                        console.log(err);
                      } else {
                        console.log(doc);
                      }
                    });

                  }
            });
        }
        // Log that scrape is working, just the content was missing parts
        else{
          console.log('Article already exists.')
        }

          }
          // Log that scrape is working, just the content was missing parts
          else{
            console.log('Not saved to DB, missing data')
          }
        });
        // after scrape, redirects to index
        res.redirect('/');
    });
});

//this will grab every article an populate the DOM
router.get('/articles', function(req, res) {
    //allows newer articles to be on top
    //debugger
    Article.find().sort({_id: -1})
        //send to handlebars
        .exec(function(err, doc) {
            if(err){
                console.log(err);
            } else{
                var artcl = {article: doc};
                res.render('index', artcl);
            }
    });
});

// This will get the articles we scraped from the mongoDB in JSON
router.get('/articles-json', function(req, res) {
    Article.find({}, function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            res.json(doc);
        }
    });
});

//clear all articles for testing purposes
router.get('/clearAll', function(req, res) {
    Article.remove({}, function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            console.log('removed all articles');
        }

    });
    res.redirect('/articles-json');
});

router.get('/readArticle/:id', function(req, res){
  debugger
  var articleId = req.params.id;
  var hbsObj = {
    article: [],
    body: []
  };

    // //find the article at the id
    Article.findOne({ _id: articleId })
      .populate('comment')
      .exec(function(err, doc){
      if(err){
        console.log('Error: ' + err);
      } else {
        hbsObj.article = doc;
        var link = doc.link;
        //grab article from link
        axios.get(link).then(function(response){
          var $ = cheerio.load(response.data);

          $('.story-body-supplemental').each(function(i, element){
            hbsObj.body = $(this).children('.story-body').children('p').text();
            //send article body and comments to article.handlbars through hbObj
            res.render('article', hbsObj);
            //prevents loop through so it doesn't return an empty hbsObj.body
            return false;
          });
        });
      }

    });
});

// Create a new comment
router.post('/comment/:id', function(req, res) {
  var user = req.body.name;
  var content = req.body.comment;
  var articleId = req.params.id;

  //submitted form
  var commentObj = {
    name: user,
    body: content
  };
 
  //using the Comment model, create a new comment
  var newComment = new Comment(commentObj);

  newComment.save(function(err, doc) {
      if (err) {
          console.log(err);
      } else {
          console.log(doc._id)
          console.log(articleId)
          Article.findOneAndUpdate({ "_id": req.params.id }, {$push: {'comment':doc._id}}, {new: true})
            //execute everything
            .exec(function(err, doc) {
                if (err) {
                    console.log(err);
                } else {
                    res.redirect('/readArticle/' + articleId);
                }
            });
        }
  });
});

//for getting all saved articles
router.get('/savedArticle', function(req, res){
  //debugger
    Article.find({})
    .where('saved').equals(true)
    .where('deleted').equals(false)
    .exec(function(err, articlesSaved){

        if(err){
          console.log(err);
          res.status(500);
        }else{
          console.log(articlesSaved);
          var savedOnces = {
            articles: articlesSaved
          };
          res.render('saved', savedOnces);
        }
    })
})

//save an article
router.post('/save/:id', function(req,res){

  Article.findByIdAndUpdate(req.params.id, {
        $set: { saved: true}
        },
        { new: true },
        function(error, doc) {
            if (error) {
                console.log(error);
                res.status(500);
            } else {
                res.redirect('/');
            }
        });

})

//delete the saved article
router.post('/deleteArticle/:id', function(req, res){
  //debugger
  Article.findByIdAndUpdate(req.params.id, 
      {$set: { deleted: true}},
      { new: true },
      function(error, doc) {
            if (error) {
                console.log(error);
                res.status(500);
            } else {
                res.redirect('/savedArticle');
            }
      });

})
//for getting all deleted articles
router.get('/deleted', function(req, res){

  Article.find({})
    .where('deleted').equals(true)
    .exec(function(err, deletedArticles){
      if(err){
        console.log(error);
        res.status(500);
      }
      else{

        console.log(deletedArticles);
        var deletedOnces = {
          articles: deletedArticles
        };
        res.render('deleted', deletedOnces);

      }

    });

});

//delete required comment
router.post('/deleteComment/:id', function(req, res){
  //debugger
  Comment.findByIdAndRemove(req.params.id, function(error, data) {
            if (error) {
                console.log(error);
                res.status(500);
            } else {
               // res.redirect(`/readArticle/${req.params.id}`);
               res.redirect('/articles');
            }
      });


})

module.exports = router;
