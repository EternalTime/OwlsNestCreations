# `{% include_optional <file> %}` is `include` for a piece a game may not have.
#
# Every game's file ends with the same line, the include of its own page copy,
# and an unreleased game's copy is deliberately not in this repository (see
# `.gitignore`). Jekyll renders a document's Liquid whether or not the document
# is going to be written, so a plain `include` of an absent copy file fails the
# build rather than skipping the page nobody is publishing. Liquid cannot ask
# whether a file exists, so this tag asks: present, it renders exactly as
# `include` does; absent, it renders nothing.
#
# Only genuinely optional pieces get this tag. A banner's block, field and
# runtime stay plain `include`s, so a typo in a game's `banner` is still a
# build error rather than a silently empty page.
module OwlsNest
  class IncludeOptionalTag < Jekyll::Tags::IncludeTag
    def render(context)
      file = render_variable(context) || @file
      validate_file_name(file)

      site = context.registers[:site]
      found = tag_includes_dirs(context).any? do |dir|
        valid_include_file?(Jekyll::PathManager.join(dir, file), dir.to_s, site.safe)
      end

      found ? super : ""
    end
  end
end

Liquid::Template.register_tag("include_optional", OwlsNest::IncludeOptionalTag)
