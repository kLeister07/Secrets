// ====================== Bonus stuff ====================

// if u want to add the ability for the user to add or delete
//  any of their secrets

// "/submit" route handling

app.route("/submit")
.get(function (req,res){
  if(req.isAuthenticated()){
    User.findById(req.user.id,function (err,foundUser){
      if(!err){
        res.render("submit",{secrets:foundUser.secret});
      }
    })
  }else {
    res.redirect("/login");
  }
})
.post(function (req, res){
  if(req.isAuthenticated()){
    User.findById(req.user.id,function (err, user){
      user.secret.push(req.body.secret);
      user.save(function (){
        res.redirect("/secrets");
      });
    });
 
  }else {
   res.redirect("/login");
  }
});
// the handling of the new route "/submit/delete"

app.post("/submit/delete",function (req, res){
  if(req.isAuthenticated()){
    User.findById(req.user.id, function (err,foundUser){
      foundUser.secret.splice(foundUser.secret.indexOf(req.body.secret),1);
      foundUser.save(function (err) {
        if(!err){
          res.redirect("/submit");
        }
      });
    });
  }else {
    res.redirect("/login");
  }
});


// in submit.ejs , after the first form add this

// <% if(secrets.length != 0){ %>
//     <hr>
//       <h1 class="display-3">Your Secrets</h1>
//       <form  action="/submit/delete" method="post">
//         <div class="form-group">
//           <select class="form-control text-center" name="secret">
//             <% secrets.forEach(function(secret){ %>
//               <option value="<%= secret %>"><%= secret %></option>
//             <% }); %>
//           </select>
//         </div>
//         <button type="submit" class="btn btn-dark">Delete Secret</button>
//       </form>
// <%  } %>

// After this , the user will be able to select and delete any of his secrets.