# A game's `released` switch is also its page's publish switch: until the game
# is out, its page sits in the repository and is never written to the site.
#
# Jekyll's own `published: false` cannot do this alone. A document is tested
# for it while the collection is being read, and an unpublished one is dropped
# from `site.games` there and then, which would take the game's banner off the
# home page along with its page. Setting it after the read keeps the document
# in the collection for the banner to draw from, and still stops Jekyll writing
# it, because that is decided later, in `Jekyll::Publisher#publish?`.
Jekyll::Hooks.register :site, :post_read do |site|
  site.collections["games"].docs.each do |game|
    game.data["published"] = false unless game.data["released"]
  end
end
