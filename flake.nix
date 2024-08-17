{
  description = "A basic flake using pyproject.toml project metadata";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-24.05";
    pyproject-nix = {
      url = "github:nix-community/pyproject.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, pyproject-nix, ... }:
    let
      inherit (nixpkgs) lib;
    
      project = pyproject-nix.lib.project.loadPyproject {
        # Read & unmarshal pyproject.toml relative to this project root.
        # projectRoot is also used to set `src` for renderers such as buildPythonPackage.
        projectRoot = ./.;
        pyproject = (builtins.fromTOML (builtins.readFile ./pyproject.toml));
      };

      # This example is only using x86_64-linux
      pkgs = (nixpkgs.legacyPackages.x86_64-linux.extend (final: prev: {
        python310 = prev.python310.override {
          packageOverrides = pfinal: pprev: {
            chromadb = pprev.chromadb.overrideAttrs (oldAttrs: {
              pytestCheckPhase = "true";
            });
          };
        };
      }));

      python = pkgs.python310;
    in
    {
    
      # Build our package using `buildPythonPackage
      packages.x86_64-linux.default =
        let
          # Returns an attribute set that can be passed to `buildPythonPackage`.
          attrs = project.renderers.buildPythonPackage { inherit python; };
        in
        # Pass attributes to buildPythonPackage.
        # Here is a good spot to add on any missing or custom attributes.
        python.pkgs.buildPythonPackage attrs;
    };
}

